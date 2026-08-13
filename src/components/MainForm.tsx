import { useEffect, useState, useRef } from "react";
import { 
  FileEdit, Sparkles, CheckCircle2, FileDown, 
  Loader2, Info, BrainCircuit, ArrowRight, 
  Upload, X, Paperclip, FileText,
  Settings as SettingsIcon, LayoutTemplate
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { generateAgnesReport, generateAgnes5Why } from "@/lib/agnesClient";
import { generateGeminiReport, generateGemini5Why } from "@/lib/geminiClient";
import { exportToDocx } from "@/lib/docxExporter";
import { exportToHtml } from "@/lib/htmlExporter";
import { ReportHistoryItem, saveHistory } from "@/lib/historyManager";
import { parseFile } from "@/lib/fileParser";
import { getTemplateContent } from "@/lib/templateStore";
import { buildEnhancedReportPrompt } from "@/lib/tools/promptBuilder";
import { calculateRPN, findSimilarCases } from "@/lib/tools/analysisTools";
import { getHistory } from "@/lib/historyManager";

interface MainFormProps {
  onReportGenerated: (item: ReportHistoryItem) => void;
  selectedHistory: ReportHistoryItem | null;
}

type AppStep = "input" | "analysis" | "final";

export default function MainForm({ onReportGenerated, selectedHistory }: MainFormProps) {
  const [step, setStep] = useState<AppStep>(selectedHistory ? "final" : "input");
  const [formData, setFormData] = useState({
    // 問題描述結構化欄位
    problemTitle: selectedHistory?.problemDescription || "", // 問題標題
    occurrenceTime: selectedHistory?.date || new Date().toISOString().split("T")[0], // 發生時間
    location: "", // 發生地點/線別
    defectDescription: "", // 缺陷現象詳細描述
    detectionMethod: "", // 發現方式
    impactScope: "", // 影響範圍
    preliminaryCause: "", // 初步原因猜測
    // 基礎資料
    date: selectedHistory?.date || new Date().toISOString().split("T")[0],
    defectQuantity: selectedHistory?.defectQuantity || 1,
    productInfo: selectedHistory?.productInfo || "",
    customerName: selectedHistory?.customerName || "",
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string>(selectedHistory?.generatedContent || "");
  const [errorMsg, setErrorMsg] = useState("");
  
  // UI State
  const [showEditor, setShowEditor] = useState(false);

  // 5-Why Analysis State
  const [analysisHistory, setAnalysisHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [currentAnalystQuestion, setCurrentAnalystQuestion] = useState("");
  const [userInput, setUserInput] = useState("");

  // File Upload State
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; content: string }[]>([]);
  const [isParsingFiles, setIsParsingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isMounted, setIsMounted] = useState(false);
  
  // 風險評估狀態
  const [riskAssessment, setRiskAssessment] = useState<{
    severity: number;
    occurrence: number;
    detection: number;
    rpn: number;
    priority: 'high' | 'medium' | 'low';
  } | null>(null);
  
  // 相似案例狀態
  const [similarCases, setSimilarCases] = useState<any[]>([]);
  
  // 分析進度狀態
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisMessage, setAnalysisMessage] = useState("");

  useEffect(() => {
    if (step === "analysis") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [analysisHistory, currentAnalystQuestion, step]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return <div className="flex-1 bg-(--bg-surface) animate-pulse" />;

  const getAISettings = () => {
    const provider = localStorage.getItem("ai-provider") || "agnes";
    const apiKey = localStorage.getItem("agnes-api-key") || localStorage.getItem("gemini-api-key") || "";
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



  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 計算風險評估與相似案例
  const analyzeRiskAndSimilarity = () => {
    // 計算 RPN
    const rpnResult = calculateRPN(
      formData.defectDescription,
      formData.impactScope,
      formData.detectionMethod
    );
    setRiskAssessment(rpnResult);
    
    // 尋找相似案例
    const history = getHistory();
    const caseMatches = findSimilarCases(
      {
        defectType: formData.defectDescription.substring(0, 20),
        product: formData.productInfo,
        location: formData.location
      },
      history
    );
    setSimilarCases(caseMatches);
  };

  const startAnalysis = async () => {
    if (!formData.problemTitle || !formData.defectDescription) {
      setErrorMsg("請填寫問題標題與缺陷現象描述");
      return;
    }
    setErrorMsg("");
    setStep("analysis");
    setIsGenerating(true);
    setCurrentAnalystQuestion("");

    const { provider, apiKey } = getAISettings();
    const fileContext = uploadedFiles.map(f => `檔案 [${f.name}]:\n${f.content}`).join("\n\n");
    
    const problemContext = [
      formData.problemTitle && `【問題標題】${formData.problemTitle}`,
      formData.location && `【發生地點/線別】${formData.location}`,
      formData.detectionMethod && `【發現方式】${formData.detectionMethod}`,
      formData.impactScope && `【影響範圍】${formData.impactScope}`,
      formData.preliminaryCause && `【初步原因猜測】${formData.preliminaryCause}`,
      formData.defectDescription && `【缺陷現象詳細描述】\n${formData.defectDescription}`
    ].filter(Boolean).join("\n\n");
    
    const fullContext = `${problemContext}\n\n[附件資料背景]\n${fileContext}`;
    
    // 執行風險評估與相似案例搜尋
    analyzeRiskAndSimilarity();
    setAnalysisMessage("正在進行風險評估與歷史案例比對...");
    setAnalysisStep(1);

    try {
      let firstQuestion = "";
      const callback = (chunk: string) => {
        firstQuestion += chunk;
        setCurrentAnalystQuestion(prev => prev + chunk);
      };

      if (provider === "gemini" && apiKey) {
        await generateGemini5Why(apiKey, fullContext, [], callback);
      } else if (provider === "agnes" && apiKey) {
        await generateAgnes5Why(apiKey, fullContext, [], callback);
      } else {
        setErrorMsg("請設定 API Key");
        setIsGenerating(false);
        return;
      }
      
      setAnalysisHistory([{ role: "assistant", content: firstQuestion }]);
    } catch {
      setErrorMsg(provider === "gemini" ? "Gemini 連線失敗，請檢查 API Key" : "Agnes AI 連線失敗，請檢查 API Key");
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
    
    const problemContext = [
      formData.problemTitle && `【問題標題】${formData.problemTitle}`,
      formData.location && `【發生地點/線別】${formData.location}`,
      formData.detectionMethod && `【發現方式】${formData.detectionMethod}`,
      formData.impactScope && `【影響範圍】${formData.impactScope}`,
      formData.preliminaryCause && `【初步原因猜測】${formData.preliminaryCause}`,
      formData.defectDescription && `【缺陷現象詳細描述】\n${formData.defectDescription}`
    ].filter(Boolean).join("\n\n");
    
    const fullContext = `${problemContext}\n\n[附件資料背景]\n${fileContext}`;

    try {
      let nextQuestion = "";
      const callback = (chunk: string) => {
        nextQuestion += chunk;
        setCurrentAnalystQuestion(prev => prev + chunk);
      };

      if (provider === "gemini" && apiKey) {
        await generateGemini5Why(apiKey, fullContext, newHistory, callback);
      } else if (provider === "agnes" && apiKey) {
        await generateAgnes5Why(apiKey, fullContext, newHistory, callback);
      } else {
        setErrorMsg("分析過程中斷 - 請檢查 API Key");
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

    // 使用增強型報告生成提示
    const reportPrompt = buildEnhancedReportPrompt(analysisSummary, formData);

    let fullResult = "";
    const callback = (chunk: string) => {
      fullResult += chunk;
      setGeneratedContent(prev => prev + chunk);
    };

    try {
      if (provider === "gemini" && apiKey) {
        await generateGeminiReport(apiKey, reportPrompt, callback);
      } else if (provider === "agnes" && apiKey) {
        await generateAgnesReport(apiKey, reportPrompt, callback);
      } else {
        setErrorMsg("最終生成失敗 - 請檢查 API Key");
      }
      
      const newHistory = saveHistory({
        date: formData.date,
        productInfo: formData.productInfo,
        customerName: formData.customerName,
        defectQuantity: formData.defectQuantity,
        problemDescription: [
          formData.problemTitle,
          formData.defectDescription
        ].filter(Boolean).join('\n'),
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
**問題標題**: ${formData.problemTitle}
**發生時間**: ${formData.occurrenceTime}
**發生地點/線別**: ${formData.location}
**缺陷現象詳細描述**: ${formData.defectDescription}
${formData.detectionMethod ? `**發現方式**: ${formData.detectionMethod}\n` : ''}
${formData.impactScope ? `**影響範圍**: ${formData.impactScope}\n` : ''}
${formData.preliminaryCause ? `**初步原因猜測**: ${formData.preliminaryCause}\n` : ''}

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

  const handleExportHtml = () => {
    if (!generatedContent) return;
    exportToHtml(generatedContent, "8D_Report_" + (formData.productInfo || "Draft"));
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-(--bg-base) scrollbar-premium">
      <div className="max-w-[1800px] mx-auto p-4 lg:p-6 pb-32 space-y-6 flex flex-col items-center w-full">
        
        {/* Current Stage Indicator (Elevated to top) */}
        <div className="flex items-center justify-center gap-4 py-2 mb-2">
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
        <main className="w-full flex-1 flex flex-col min-h-0">

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
          <div className="premium-card p-6 lg:p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-full mx-auto shadow-2xl border-t-4 border-t-(--accent)">
            
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold text-(--text-primary)">8D 報告參數設定</h1>
              <p className="text-sm text-(--text-secondary)">請填寫基礎缺陷資訊，AI 將引導您進行後續的 5-Why 推導。</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Left Column: Problem Description & Files */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-(--text-primary) mb-4 flex items-center gap-2">
                    <FileEdit className="w-5 h-5 text-(--accent)" /> 問題現象描述
                  </h3>
                  
                  {/* Structured Problem Description Fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="input-label">
                        <span className="font-semibold">問題標題 *</span>
                        <span className="text-(--text-secondary) font-normal ml-1">簡潔描述問題核心</span>
                      </label>
                      <input 
                        type="text" 
                        name="problemTitle" 
                        value={formData.problemTitle} 
                        onChange={handleChange} 
                        placeholder="例: XX產品表面刮傷不良率異常升高"
                        className="fluent-input w-full"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="input-label">發生日期 *</label>
                        <input type="date" name="occurrenceTime" value={formData.occurrenceTime} onChange={handleChange} className="fluent-input w-full" />
                      </div>
                      <div>
                        <label className="input-label">發生地點/線別</label>
                        <input 
                          type="text" 
                          name="location" 
                          value={formData.location} 
                          onChange={handleChange} 
                          placeholder="例: SMT線別A / 成品倉庫"
                          className="fluent-input w-full"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="input-label">
                        <span className="font-semibold">缺陷現象詳細描述 *</span>
                        <span className="text-(--text-secondary) font-normal ml-1">包含觀察到的具體不良現象、缺陷特徵、數量比例等</span>
                      </label>
                      <textarea 
                        name="defectDescription" 
                        value={formData.defectDescription} 
                        onChange={handleChange} 
                        className="fluent-textarea min-h-[150px] text-base" 
                        placeholder="請詳細描述：&#10;• 缺陷的具體表現（如：刮傷、鏽蝕、尺寸超差...）&#10;• 缺陷的嚴重程度或比例&#10;• 缺陷發生的頻率&#10;• 與其他正常產品的差異點"
                      />
                    </div>
                    
                    <div>
                      <label className="input-label">發現方式</label>
                      <input 
                        type="text" 
                        name="detectionMethod" 
                        value={formData.detectionMethod} 
                        onChange={handleChange} 
                        placeholder="例: IQC進料檢驗 / 生產線自檢 / 客戶驗貨"
                        className="fluent-input w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="input-label">影響範圍</label>
                      <input 
                        type="text" 
                        name="impactScope" 
                        value={formData.impactScope} 
                        onChange={handleChange} 
                        placeholder="例: 批次 B2024001-B2024005 / 約2000 pcs / 涉及客戶ABC"
                        className="fluent-input w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="input-label">初步原因猜測</label>
                      <input 
                        type="text" 
                        name="preliminaryCause" 
                        value={formData.preliminaryCause} 
                        onChange={handleChange} 
                        placeholder="例: 刀具磨損 / 溫度設定不當 / 作業員疏失"
                        className="fluent-input w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="input-label flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-(--accent)" />
                    上傳參考資料 (Excel/PDF/Word/TXT)
                  </label>
                  
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-(--border-color) hover:border-(--accent) bg-(--bg-base)/30 rounded-2xl p-6 transition-all cursor-pointer group flex flex-col items-center justify-center gap-2"
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      multiple 
                      className="hidden" 
                      accept=".xlsx,.xls,.docx,.pdf,.txt"
                    />
                    <Upload className="w-6 h-6 text-(--accent) group-hover:scale-110 transition-transform" />
                    <p className="text-[13px] font-bold text-(--text-primary)">
                      {isParsingFiles ? "解析中..." : "點擊或拖拽上傳文件"}
                    </p>
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="grid grid-cols-1 gap-2 mt-2">
                      {uploadedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-white border border-(--border-color) rounded-xl shadow-sm group">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileText className="w-3.5 h-3.5 text-(--accent)" />
                            <p className="text-[11px] font-bold text-(--text-primary) truncate">{file.name}</p>
                          </div>
                          <button onClick={() => removeFile(idx)} className="p-1 hover:text-red-500 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Metadata & Submit */}
              <div className="flex flex-col space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-(--text-primary) mb-4">基礎資料紀錄</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="input-label">發生日期</label>
                      <input type="date" name="date" value={formData.date} onChange={handleChange} className="fluent-input" />
                    </div>
                    <div>
                      <label className="input-label">不良數量</label>
                      <input type="number" name="defectQuantity" value={formData.defectQuantity} onChange={handleChange} className="fluent-input" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="input-label">產品/型號</label>
                      <input type="text" name="productInfo" value={formData.productInfo} onChange={handleChange} placeholder="輸入型號..." className="fluent-input" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="input-label">客戶名稱</label>
                      <input type="text" name="customerName" value={formData.customerName} onChange={handleChange} placeholder="輸入客戶..." className="fluent-input" />
                    </div>
                  </div>
                </div>

                <div className="flex-1" />

                <div className="pt-6 border-t border-(--border-color)">
                  <button 
                    onClick={startAnalysis} 
                    disabled={isGenerating || isParsingFiles}
                    className="btn-primary w-full h-14 shadow-xl shadow-(--accent)/20 text-lg"
                  >
                    {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <BrainCircuit className="w-6 h-6" />}
                    <span>開始引導式分析</span>
                  </button>
                  <p className="text-[11px] text-(--text-secondary) text-center mt-3">
                    AI 將根據您提供的資訊，協助推導 5-Why 根因與矯正措施。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: 5-WHY ANALYSIS */}
        {step === "analysis" && (
          <div className="premium-card p-6 lg:p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-[600px]">
              {/* Interaction Panel (Middle Column) */}
              <div className="lg:col-span-12 xl:col-span-5 flex flex-col space-y-6">
                <div className="premium-card p-6 flex-1 flex flex-col shadow-xl">
                  <div className="flex items-center justify-between border-b border-(--border-color) pb-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-(--accent)/10 p-2 rounded-lg">
                        <BrainCircuit className="w-5 h-5 text-(--accent)" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-(--text-primary)">5-Why 診斷中</h2>
                        <p className="text-[10px] text-(--text-secondary) font-bold uppercase tracking-wider">Interactive Assistant</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar min-h-[400px]">
                    {analysisHistory.map((chat, idx) => (
                      <div key={idx} className={`flex ${chat.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[90%] p-3 rounded-2xl ${
                          chat.role === "user" ? 
                          "bg-(--accent) text-white shadow-md shadow-(--accent)/20" : 
                          "bg-(--bg-surface) border border-(--border-color) text-(--text-primary)"
                        }`}>
                          <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{chat.content}</p>
                        </div>
                      </div>
                    ))}
                    
                    {isGenerating && currentAnalystQuestion && (
                      <div className="flex justify-start">
                        <div className="max-w-[90%] p-3 rounded-2xl bg-(--bg-surface) border border-(--border-color) text-(--text-primary)">
                          <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{currentAnalystQuestion}</p>
                          <Loader2 className="w-3 h-3 animate-spin mt-2 opacity-30" />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="mt-4 pt-4 border-t border-(--border-color)">
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
                        placeholder="輸入您的觀察或回答..."
                        className="w-full bg-(--bg-base) border border-(--border-color) rounded-xl p-4 pr-12 text-[13px] focus:ring-2 focus:ring-(--accent)/20 focus:border-(--accent) transition-all resize-none min-h-[100px]"
                        disabled={isGenerating}
                      />
                      <button
                        onClick={handleAnalysisReply}
                        disabled={!userInput.trim() || isGenerating}
                        className="absolute right-3 bottom-3 p-2 bg-(--accent) text-white rounded-lg hover:bg-(--accent-hover) disabled:opacity-30 transition-all shadow-md shadow-(--accent)/20"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex justify-between items-center mt-3">
                      <p className="text-[10px] text-(--text-secondary)">按 Enter 發送，Shift + Enter 換行</p>
                      <button 
                        onClick={() => handleFinalGenerate()}
                        className="text-[11px] font-bold text-(--accent) hover:underline"
                      >
                        直接生成 8D 報告 (跳過分析) →
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Panel (Right Column) */}
              <div className="lg:col-span-12 xl:col-span-7 flex flex-col space-y-4">
                {/* Risk Assessment Badge */}
                {riskAssessment && (
                  <div className="premium-card p-4 flex items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-xs font-bold text-(--text-secondary) uppercase tracking-wider">風險評估</span>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                        riskAssessment.priority === 'high' 
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400' 
                          : riskAssessment.priority === 'medium'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-green-500/10 text-green-600 dark:text-green-400'
                      }`}>
                        {riskAssessment.priority === 'high' ? '高優先級' : riskAssessment.priority === 'medium' ? '中優先級' : '低優先級'}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-(--text-secondary)">
                        <span>S: {riskAssessment.severity}</span>
                        <span>O: {riskAssessment.occurrence}</span>
                        <span>D: {riskAssessment.detection}</span>
                        <span className="font-bold text-(--text-primary)">RPN: {riskAssessment.rpn}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Similar Cases Alert */}
                {similarCases.length > 0 && (
                  <div className="premium-card p-4 bg-(--accent)/5 border-(--accent)/20">
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-(--accent) shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-[12px] font-bold text-(--accent) mb-1">發現 {similarCases.length} 個相似歷史案例</p>
                        <p className="text-[11px] text-(--text-secondary)">
                          {similarCases.map((c, i) => `案例 #${c.caseId}(相似度${c.similarity}%)`).join('、')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="premium-card flex-1 flex flex-col shadow-xl overflow-hidden border-t-4 border-t-(--accent)">
                  <div className="bg-(--bg-surface) p-4 border-b border-(--border-color) flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <div className="p-1.5 rounded-md bg-(--accent)/10">
                         <FileText className="w-4 h-4 text-(--accent)" />
                       </div>
                       <span className="text-[13px] font-bold text-(--text-primary)">即時報告預覽 (Live Preview)</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-400/20" />
                      <div className="w-2 h-2 rounded-full bg-amber-400/20" />
                      <div className="w-2 h-2 rounded-full bg-emerald-400/20" />
                    </div>
                  </div>
                  <div className="flex-1 p-6 lg:p-10 bg-white dark:bg-(--bg-base)/50 overflow-y-auto custom-scrollbar prose dark:prose-invert max-w-none">
                    <ReactMarkdown>{generatedContent || "# 報告生成中...\n完成 5-Why 對話或點擊跳過即可生成完整 8D 報告。"}</ReactMarkdown>
                  </div>
                </div>
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
                    <button onClick={handleExportHtml} className="btn-secondary h-10 px-6">
                      <FileText className="w-4 h-4 mr-2" /> 匯出 HTML
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
      </main>
    </div>
  </div>
);
}
