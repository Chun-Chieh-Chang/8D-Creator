import { useEffect, useState, useRef } from "react";
import { 
  FileEdit, 
  Sparkles, 
  CheckCircle2, 
  FileDown, 
  Loader2, 
  Info,
  Send, 
  BrainCircuit, 
  ArrowRight, 
  RotateCcw, 
  Upload, 
  X, 
  Paperclip, 
  FileText,
  Settings as SettingsIcon, 
  LayoutTemplate
} from "lucide-react";
import { generate8DReport, generate5WhyQuestion } from "@/lib/ollamaClient";
import { generateGeminiReport, generateGemini5Why } from "@/lib/geminiClient";
import { exportToDocx } from "@/lib/docxExporter";
import { ReportHistoryItem, saveHistory } from "@/lib/historyManager";
import { parseFile } from "@/lib/fileParser";
import { getActivePromptTemplate, getTemplateMode, getCustomTemplate, setCustomTemplate, setUploadedTemplate } from "@/lib/templateStore";

interface MainFormProps {
  onReportGenerated: (item: ReportHistoryItem) => void;
  selectedHistory: ReportHistoryItem | null;
}

type AppStep = "input" | "analysis" | "final";

export default function MainForm({ onReportGenerated, selectedHistory }: MainFormProps) {
  const [step, setStep] = useState<AppStep>(selectedHistory ? "final" : "input");
  const [formData, setFormData] = useState({
    problemDescription: selectedHistory?.problemDescription || "",
    date: selectedHistory?.date || new Date().toISOString().split("T")[0],
    defectQuantity: selectedHistory?.defectQuantity || 1,
    productInfo: selectedHistory?.productInfo || "",
    customerName: selectedHistory?.customerName || "",
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string>(selectedHistory?.generatedContent || "");
  const [errorMsg, setErrorMsg] = useState("");
  
  // Template & UI State
  const [templateMode, setTemplateMode] = useState(getTemplateMode());
  const [showEditor, setShowEditor] = useState(false);
  const [customDraft, setCustomDraft] = useState(getCustomTemplate());

  // 5-Why Analysis State
  const [analysisHistory, setAnalysisHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [currentAnalystQuestion, setCurrentAnalystQuestion] = useState("");
  const [userInput, setUserInput] = useState("");

  // File Upload State
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; content: string }[]>([]);
  const [isParsingFiles, setIsParsingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateUploadRef = useRef<HTMLInputElement>(null);

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const handleUpdate = () => {
      setTemplateMode(getTemplateMode());
      setCustomDraft(getCustomTemplate());
    };
    window.addEventListener("template-settings-changed", handleUpdate);
    return () => window.removeEventListener("template-settings-changed", handleUpdate);
  }, []);

  if (!isMounted) return <div className="flex-1 bg-(--bg-surface) animate-pulse" />;

  const getAISettings = () => {
    const provider = localStorage.getItem("ai-provider") || "ollama";
    const apiKey = localStorage.getItem("gemini-api-key") || "";
    return { provider, apiKey };
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setIsParsingFiles(true);
    const files = Array.from(e.target.files);
    
    for (const file of files) {
      try {
        const content = await parseFile(file);
        setUploadedFiles(prev => [...prev, { name: file.name, content }]);
      } catch {
        console.error("File parse error");
      }
    }
    setIsParsingFiles(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setIsParsingFiles(true);
    try {
      const content = await parseFile(e.target.files[0]);
      setUploadedTemplate(content);
      setErrorMsg("模板上傳成功！已切換至上傳模板模式。");
      setTimeout(() => setErrorMsg(""), 3000);
    } catch {
      console.error("Template parse error");
      setErrorMsg("模板讀取失敗");
    } finally {
      setIsParsingFiles(false);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startAnalysis = async () => {
    if (!formData.problemDescription) {
      setErrorMsg("請輸入問題描述 (Problem Description is required)");
      return;
    }
    setErrorMsg("");
    setStep("analysis");
    setIsGenerating(true);
    setCurrentAnalystQuestion("");

    const { provider, apiKey } = getAISettings();
    const fileContext = uploadedFiles.map(f => `檔案 [${f.name}]:\n${f.content}`).join("\n\n");
    const fullContext = `問題描述：${formData.problemDescription}\n\n[附件資料背景]\n${fileContext}`;

    try {
      let firstQuestion = "";
      const callback = (chunk: string) => {
        firstQuestion += chunk;
        setCurrentAnalystQuestion(prev => prev + chunk);
      };

      if (provider === "gemini" && apiKey) {
        await generateGemini5Why(apiKey, fullContext, [], callback);
      } else {
        await generate5WhyQuestion(fullContext, [], callback);
      }
      
      setAnalysisHistory([{ role: "assistant", content: firstQuestion }]);
    } catch {
      setErrorMsg(provider === "gemini" ? "Gemini 連線失敗，請檢查 API Key" : "Ollama 分析初始化失敗");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnalysisReply = async () => {
    if (!userInput.trim() || isGenerating) return;

    const newHistory = [...analysisHistory, { role: "user" as const, content: userInput }];
    setAnalysisHistory(newHistory);
    setUserInput("");
    setIsGenerating(true);
    setCurrentAnalystQuestion("");

    const { provider, apiKey } = getAISettings();
    const fileContext = uploadedFiles.map(f => `檔案 [${f.name}]:\n${f.content}`).join("\n\n");
    const fullContext = `問題描述：${formData.problemDescription}\n\n[附件資料背景]\n${fileContext}`;

    try {
      let nextQuestion = "";
      const callback = (chunk: string) => {
        nextQuestion += chunk;
        setCurrentAnalystQuestion(prev => prev + chunk);
      };

      if (provider === "gemini" && apiKey) {
        await generateGemini5Why(apiKey, fullContext, newHistory, callback);
      } else {
        await generate5WhyQuestion(fullContext, newHistory, callback);
      }

      if (nextQuestion.includes("[FINISH_ANALYSIS]")) {
        setStep("final");
        handleFinalGenerate(newHistory);
      } else {
        setAnalysisHistory(prev => [...prev, { role: "assistant", content: nextQuestion }]);
      }
    } catch {
      setErrorMsg("分析過程中斷");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinalGenerate = async (finalHistory = analysisHistory) => {
    setErrorMsg("");
    setGeneratedContent("");
    setIsGenerating(true);
    
    const { provider, apiKey } = getAISettings();
    const fileContext = uploadedFiles.map(f => `檔案 [${f.name}]:\n${f.content}`).join("\n\n");

    const analysisSummary = finalHistory
      .map(h => `${h.role === "user" ? "用戶回答" : "專家追問"}: ${h.content}`)
      .join("\n");

    const templateRaw = getActivePromptTemplate();
    const finalizedTemplate = templateRaw
      .replace(/{{DATE}}/g, formData.date)
      .replace(/{{PRODUCT}}/g, formData.productInfo)
      .replace(/{{CUSTOMER}}/g, formData.customerName)
      .replace(/{{QUANTITY}}/g, String(formData.defectQuantity))
      .replace(/{{DESCRIPTION}}/g, formData.problemDescription)
      .replace(/{{5WHY_SUMMARY}}/g, analysisSummary);

    const prompt = `你是一名資深質量工程師。請根據以下背景資料與 5-Why 分析結果，生成一份專業、具備深度「說服力」且「表述生動」的 8D 報告。
    
    [核心目標]
    這份報告將作為 NotebookLM 的知識來源 (Source) 以及後續 Gemini Pro 進一步分析的基礎。請確保邏輯嚴密、措辭強而有力，能讓閱讀者一眼看出改善的決心與成效。

    [語言與格式要求]
    1. 報告內容必須全程使用「中英文對照」呈現 (Bilingual Output)。
    2. 中文部分「嚴禁使用簡體字」，必須全數使用「繁體中文」。
    3. 直接輸出報告內容，不要包含多餘的寒暄語。
    4. 必須嚴格遵循下方提供的「模板格式」進行輸出。

    [附件參考資料]
    ${fileContext}

    [5-Why 交互分析結果]
    ${analysisSummary}
    
    [模板格式要求]
    ${finalizedTemplate}`;

    let fullResult = "";
    const callback = (chunk: string) => {
      fullResult += chunk;
      setGeneratedContent(prev => prev + chunk);
    };

    try {
      if (provider === "gemini" && apiKey) {
        await generateGeminiReport(apiKey, prompt, callback);
      } else {
        await generate8DReport(prompt, callback);
      }
      
      const newHistory = saveHistory({
        date: formData.date,
        productInfo: formData.productInfo,
        customerName: formData.customerName,
        defectQuantity: formData.defectQuantity,
        problemDescription: formData.problemDescription,
        generatedContent: fullResult,
      });
      
      onReportGenerated(newHistory);
    } catch (err: unknown) {
      console.error("Generate error:", err);
      setErrorMsg("最終生成失敗");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyForAI = () => {
    const metadata = `---
title: 8D Report - ${formData.productInfo}
date: ${formData.date}
customer: ${formData.customerName}
quantity: ${formData.defectQuantity}
type: Quality_Assurance_Report
source: 8D_Reporter_AI
---

# 8D Report Background
${formData.problemDescription}

# 5-Why Analysis Summary
${analysisHistory.map(h => `${h.role}: ${h.content}`).join("\n")}

# Final Report Content
${generatedContent}`;

    navigator.clipboard.writeText(metadata);
    setErrorMsg("已複製優化後的 Markdown (含元數據)，可直接匯入 NotebookLM 或 Gemini Pro！");
    setTimeout(() => setErrorMsg(""), 3000);
  };

  const handleDownload = () => {
    if (!generatedContent) return;
    exportToDocx(generatedContent, "8D_Report_" + (formData.productInfo || "Draft"));
  };

  return (
    <div className="flex-1 min-h-screen bg-(--bg-base) p-4 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-6">
        
        {/* Usage Instructions Banner */}
        <div className="premium-card bg-(--bg-surface)/80 backdrop-blur-md p-4 flex items-center justify-between group cursor-pointer transition-all hover:ring-2 hover:ring-(--accent)/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-(--accent)/10">
              <Info className="w-5 h-5 text-(--accent)" />
            </div>
            <h3 className="text-[15px] font-bold text-(--text-primary)">使用說明 (Usage Instructions)</h3>
          </div>
          <ArrowRight className="w-4 h-4 text-(--text-secondary) group-hover:rotate-90 transition-transform" />
        </div>
        <details className="premium-card bg-(--bg-surface)/80 backdrop-blur-md overflow-hidden transition-all duration-300">
          <summary className="px-6 py-4 flex items-center justify-between cursor-pointer list-none hover:bg-(--accent)/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-(--accent)/10">
                <Info className="w-5 h-5 text-(--accent)" />
              </div>
              <h3 className="text-[15px] font-bold text-(--text-primary)">使用說明 (Usage Instructions)</h3>
            </div>
            <ArrowRight className="w-4 h-4 text-(--text-secondary) group-open:rotate-90 transition-transform" />
          </summary>
          <div className="px-8 pb-8 pt-4 space-y-8 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-4">
              <h4 className="text-2xl font-black text-(--text-primary)">如何使用</h4>
              <ol className="space-y-4">
                {[
                  "在程序目錄下創建 config.json 文件 (選填，用於進階配置)",
                  "在左側選擇模板類型：\n• AI 標準模板：使用預設的標準 8D 格式\n• AI 自定義模板：描述您想要的格式，AI 將動態生成\n• 上傳我的模板：上傳您的 Word 模板，AI 分析後按此格式生成",
                  "填寫問題描述和其他基本信息",
                  "點擊生成按鈕，等待 AI 生成報告",
                  "下載為 Word 文檔進行存檔"
                ].map((text, i) => (
                  <li key={i} className="flex gap-4 text-[14px] leading-relaxed text-(--text-primary)">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-(--accent) text-white text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                    <span className="whitespace-pre-line">{text}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="space-y-4 pt-4 border-t border-(--border-color)/50">
              <h4 className="text-xl font-black text-(--text-primary)">小技巧</h4>
              <ul className="space-y-3">
                {[
                  "問題描述越詳細，生成的報告越精準",
                  "可以上傳檢驗數據、不良品照片作為 AI 參考資料",
                  "歷史記錄會自動保存在側邊欄，方便隨時查閱"
                ].map((text, i) => (
                  <li key={i} className="flex items-center gap-3 text-[14px] text-(--text-secondary)">
                    <div className="w-1.5 h-1.5 rounded-full bg-(--accent)/60" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </details>

        {/* Current Stage Indicator */}
        <div className="flex items-center justify-center gap-4 py-2">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all border ${step === "input" ? "bg-(--accent) text-white border-transparent shadow-lg shadow-(--accent)/20" : "bg-(--bg-surface)/50 text-(--text-secondary) border-(--border-color)"}`}>
            <FileEdit className="w-4 h-4" />
            <span className="text-xs font-bold">資訊填入</span>
          </div>
          <ArrowRight className="w-4 h-4 text-(--text-secondary) opacity-30" />
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all border ${step === "analysis" ? "bg-(--accent) text-white border-transparent shadow-lg shadow-(--accent)/20" : "bg-(--bg-surface)/50 text-(--text-secondary) border-(--border-color)"}`}>
            <BrainCircuit className="w-4 h-4" />
            <span className="text-xs font-bold">根因分析</span>
          </div>
          <ArrowRight className="w-4 h-4 text-(--text-secondary) opacity-30" />
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all border ${step === "final" ? "bg-(--accent) text-white border-transparent shadow-lg shadow-(--accent)/20" : "bg-(--bg-surface)/50 text-(--text-secondary) border-(--border-color)"}`}>
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-bold">報告完成</span>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="premium-card bg-(--bg-surface) shadow-2xl overflow-visible min-h-[600px] flex flex-col relative group/card border-t-4 border-t-(--accent)">

        {errorMsg && (
          <div className="premium-card bg-(--error)/5 border-(--error)/20 p-4 flex items-start gap-4">
            <Info className="w-5 h-5 text-(--error) shrink-0" />
            <div>
              <h3 className="text-[14px] font-bold text-(--error)">系統異常</h3>
              <p className="text-[13px] text-(--error)/80 mt-1">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* STEP 1: INPUT */}
        {step === "input" && (
          <div className="premium-card p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Template Specific Action Bar */}
            {(templateMode === "custom" || templateMode === "uploaded") && (
              <div className="p-4 rounded-2xl bg-(--accent)/5 border border-(--accent)/10 flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white shadow-sm">
                    {templateMode === "custom" ? <SettingsIcon className="w-4 h-4 text-(--accent)" /> : <LayoutTemplate className="w-4 h-4 text-(--accent)" />}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-(--text-primary)">
                      {templateMode === "custom" ? "自定義模板模式" : "已上傳模板模式"}
                    </p>
                    <p className="text-[11px] text-(--text-secondary)">AI 將依照指定結構生成報告</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {templateMode === "custom" ? (
                    <button 
                      onClick={() => setShowEditor(!showEditor)}
                      className="px-4 py-1.5 rounded-lg bg-white border border-(--border-color) text-(--accent) text-xs font-bold hover:shadow-md transition-all"
                    >
                      {showEditor ? "關閉編輯器" : "修改自定義格式"}
                    </button>
                  ) : (
                    <button 
                      onClick={() => templateUploadRef.current?.click()}
                      className="px-4 py-1.5 rounded-lg bg-white border border-(--border-color) text-(--accent) text-xs font-bold hover:shadow-md transition-all"
                    >
                      更換模板文件
                    </button>
                  )}
                  <input type="file" ref={templateUploadRef} onChange={handleTemplateUpload} className="hidden" accept=".docx,.txt" />
                </div>
              </div>
            )}

            {/* Template Editor Drawer */}
            {templateMode === "custom" && showEditor && (
              <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-bold text-(--text-primary) flex items-center gap-2">
                    <FileText className="w-4 h-4" /> 編輯自定義模板結構
                  </h3>
                  <div className="flex gap-4 text-[10px] text-(--text-secondary) font-bold uppercase tracking-tighter">
                    <span>可用變數:</span>
                    <span>{"{{DATE}}"}</span>
                    <span>{"{{PRODUCT}}"}</span>
                    <span>{"{{CUSTOMER}}"}</span>
                    <span>{"{{QUANTITY}}"}</span>
                    <span>{"{{5WHY_SUMMARY}}"}</span>
                  </div>
                </div>
                <textarea 
                  value={customDraft} 
                  onChange={(e) => setCustomDraft(e.target.value)}
                  className="fluent-textarea min-h-[300px] font-mono text-[13px] bg-(--bg-base)"
                  placeholder="輸入 8D 報告的自定義 Markdown 結構..."
                />
                <div className="flex justify-end gap-3">
                  <button 
                    onClick={() => setCustomTemplate(customDraft)}
                    className="px-6 py-2 rounded-xl bg-(--accent) text-white text-xs font-bold hover:shadow-lg transition-all"
                  >
                    儲存模板設定
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold text-(--text-primary)">8D 報告參數設定</h1>
              <p className="text-sm text-(--text-secondary)">請填寫基礎缺陷資訊，AI 將引導您進行後續的 5-Why 推導。</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="input-label">發生日期</label>
                <input type="date" name="date" value={formData.date} onChange={handleChange} className="fluent-input" />
              </div>
              <div>
                <label className="input-label">不良數量</label>
                <input type="number" name="defectQuantity" value={formData.defectQuantity} onChange={handleChange} className="fluent-input" />
              </div>
              <div>
                <label className="input-label">產品/型號</label>
                <input type="text" name="productInfo" value={formData.productInfo} onChange={handleChange} placeholder="輸入型號..." className="fluent-input" />
              </div>
              <div>
                <label className="input-label">客戶名稱</label>
                <input type="text" name="customerName" value={formData.customerName} onChange={handleChange} placeholder="輸入客戶..." className="fluent-input" />
              </div>
              <div className="md:col-span-2">
                <label className="input-label">問題現象描述</label>
                <textarea name="problemDescription" value={formData.problemDescription} onChange={handleChange} className="fluent-textarea" placeholder="描述缺陷具體現象..." />
              </div>

              {/* File Upload Section */}
              <div className="md:col-span-2 space-y-4">
                <label className="input-label flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-(--accent)" />
                  上傳相關資料 (Excel/PDF/Word/TXT)
                </label>
                
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-(--border-color) hover:border-(--accent) bg-(--bg-base)/30 rounded-2xl p-8 transition-all cursor-pointer group flex flex-col items-center justify-center gap-3"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    multiple 
                    className="hidden" 
                    accept=".xlsx,.xls,.docx,.pdf,.txt"
                  />
                  <div className="p-4 rounded-full bg-(--accent)/5 group-hover:bg-(--accent)/10 transition-colors">
                    {isParsingFiles ? (
                      <Loader2 className="w-8 h-8 text-(--accent) animate-spin" />
                    ) : (
                      <Upload className="w-8 h-8 text-(--accent)" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-[14px] font-bold text-(--text-primary)">
                      {isParsingFiles ? "正在解析檔案內容..." : "點擊或拖拽上傳參考文件"}
                    </p>
                    <p className="text-[12px] text-(--text-secondary) mt-1">
                      支援 .xlsx, .docx, .pdf, .txt 格式
                    </p>
                  </div>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 animate-in fade-in slide-in-from-top-2">
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-white border border-(--border-color) rounded-xl shadow-sm hover:shadow-md transition-shadow group">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="p-2 bg-(--accent)/5 rounded-lg">
                            <FileText className="w-4 h-4 text-(--accent)" />
                          </div>
                          <p className="text-xs font-bold text-(--text-primary) truncate">{file.name}</p>
                        </div>
                        <button 
                          onClick={() => removeFile(idx)}
                          className="p-1.5 hover:bg-red-50 text-(--text-secondary) hover:text-red-500 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button 
                onClick={startAnalysis} 
                disabled={isGenerating || isParsingFiles}
                className="btn-primary group h-12 px-8"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-5 h-5" />}
                <span className="text-base">開始根因分析</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: 5-WHY ANALYSIS */}
        {step === "analysis" && (
          <div className="premium-card p-10 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center justify-between border-b border-(--border-color) pb-6 mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-(--accent)/10 p-2 rounded-lg">
                  <BrainCircuit className="w-6 h-6 text-(--accent)" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-(--text-primary)">5-Why 交互式診斷</h2>
                  <p className="text-xs text-(--text-secondary)">AI 專家正在引導您挖掘問題根因</p>
                </div>
              </div>
            </div>

            <div className="space-y-6 max-h-[500px] overflow-y-auto px-2">
              {analysisHistory.map((chat, idx) => (
                <div key={idx} className={`flex ${chat.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl ${
                    chat.role === "user" ? 
                    "bg-(--accent) text-white" : 
                    "bg-(--bg-base) border border-(--border-color) text-(--text-primary)"
                  }`}>
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{chat.content}</p>
                  </div>
                </div>
              ))}
              
              {isGenerating && currentAnalystQuestion && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] p-4 rounded-2xl bg-(--bg-base) border border-(--border-color) text-(--text-primary)">
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{currentAnalystQuestion}</p>
                    <Loader2 className="w-3 h-3 animate-spin mt-2 opacity-50" />
                  </div>
                </div>
              )}
            </div>

            <div className="relative group">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAnalysisReply();
                  }
                }}
                disabled={isGenerating}
                placeholder="回覆分析專家的問題..."
                className="fluent-textarea bg-(--bg-base)! pr-12 pt-4"
                rows={3}
              />
              <button 
                onClick={handleAnalysisReply}
                disabled={isGenerating || !userInput.trim()}
                className="absolute bottom-4 right-4 p-2 rounded-lg bg-(--accent) text-white hover:scale-105 transition-transform disabled:opacity-30"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-(--border-color) mt-6">
              <button 
                onClick={() => setStep("input")} 
                className="text-(--text-secondary) hover:text-(--text-primary) flex items-center gap-2 text-sm font-medium transition-colors"
              >
                <RotateCcw className="w-4 h-4" /> 重新設定參數
              </button>
              <div className="flex gap-4">
                <button 
                  onClick={() => handleFinalGenerate()} 
                  className="px-6 py-2.5 rounded-xl border border-(--accent) text-(--accent) hover:bg-(--accent) hover:text-white text-sm font-bold transition-all"
                >
                  跳過對話直接生成
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: FINAL REPORT */}
        {step === "final" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {isGenerating ? (
              <div className="premium-card p-20 flex flex-col items-center justify-center space-y-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-(--accent)/20 border-t-(--accent) animate-spin"></div>
                  <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-(--accent) animate-pulse" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-(--text-primary)">報告生成中</h3>
                  <p className="text-sm text-(--text-secondary) mt-1">正在整合分析結果並優化語言風格...</p>
                </div>
              </div>
            ) : (
              <div className="premium-card overflow-hidden">
                <div className="bg-(--bg-base) border-b border-(--border-color) px-8 py-7 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-(--success)/10 p-2 rounded-lg">
                      <CheckCircle2 className="w-6 h-6 text-(--success)" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-(--text-primary)">8D 報告已完成</h2>
                      <p className="text-xs text-(--text-secondary)">內容已根據 5-Why 分析進行深度優化</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setStep("input")} 
                      className="px-4 py-2 text-xs font-bold text-(--text-secondary) hover:text-(--text-primary) transition-colors"
                    >
                      重新開始
                    </button>
                    <button 
                      onClick={copyForAI} 
                      className="btn-primary h-10 px-6 bg-(--accent) text-white"
                    >
                      <Sparkles className="w-4 h-4 mr-2" /> 複製給 AI (優化版)
                    </button>
                    <button onClick={handleDownload} className="btn-secondary h-10 px-6">
                      <FileDown className="w-4 h-4 mr-2" /> 匯出 Word
                    </button>
                  </div>
                </div>
                <div className="p-10 bg-(--bg-surface)">
                  <pre className="font-sans whitespace-pre-wrap text-[15px] text-(--text-primary) leading-[1.8] tracking-tight">
                    {generatedContent}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
