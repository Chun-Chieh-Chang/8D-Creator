import { useEffect, useState, useRef } from "react";
import { 
  FileText, CheckCircle, FileDown,
  Loader2, AlertCircle, ArrowRight, 
  Upload, X
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { generateAgnesReport, generateAgnes5Why } from "@/lib/agnesClient";
import { generateGeminiReport, generateGemini5Why } from "@/lib/geminiClient";
import { exportToDocx } from "@/lib/docxExporter";
import { exportToHtml } from "@/lib/htmlExporter";
import { exportToPdf } from "@/lib/pdfExporter";
import { ReportHistoryItem, saveHistory } from "@/lib/historyManager";
import { parseFile } from "@/lib/fileParser";
import { buildEnhancedReportPrompt } from "@/lib/tools/promptBuilder";
import { calculateRPN, findSimilarCases } from "@/lib/tools/analysisTools";
import { getHistory } from "@/lib/historyManager";

interface MainFormProps {
  onReportGenerated: (item: ReportHistoryItem) => void;
  selectedHistory: ReportHistoryItem | null;
}

type Step = "input" | "analysis" | "final";

export default function MainForm({ onReportGenerated, selectedHistory }: MainFormProps) {
  const [step, setStep] = useState<Step>(selectedHistory ? "final" : "input");
  const [formData, setFormData] = useState({
    problemTitle: selectedHistory?.problemDescription || "",
    occurrenceTime: selectedHistory?.date || new Date().toISOString().split("T")[0],
    location: "",
    defectDescription: "",
    detectionMethod: "",
    impactScope: "",
    preliminaryCause: "",
    date: selectedHistory?.date || new Date().toISOString().split("T")[0],
    defectQuantity: selectedHistory?.defectQuantity || 1,
    productInfo: selectedHistory?.productInfo || "",
    customerName: selectedHistory?.customerName || "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [reportContent, setReportContent] = useState<string>(selectedHistory?.generatedContent || "");
  const [errorMsg, setErrorMsg] = useState("");

  // Analysis state
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [userInput, setUserInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; content: string }[]>([]);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Assessment state
  const [riskResult, setRiskResult] = useState<{ rpn: number; priority: string } | null>(null);
  const [similarItems, setSimilarItems] = useState<any[]>([]);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (step === "analysis") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, currentMessage, step]);

  const getSettings = () => {
    const provider = localStorage.getItem("ai-provider") || "agnes";
    const apiKey = localStorage.getItem("agnes-api-key") || localStorage.getItem("gemini-api-key") || "";
    return { provider, apiKey };
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setIsReadingFile(true);
    const files = Array.from(e.target.files);
    
    for (const file of files) {
      try {
        const content = await parseFile(file);
        setUploadedFiles(prev => [...prev, { name: file.name, content }]);
      } catch {
        console.error("Parse error:", file.name);
      }
    }
    setIsReadingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Run risk assessment
  const runAssessment = () => {
    const rpn = calculateRPN(formData.defectDescription, formData.impactScope, formData.detectionMethod);
    setRiskResult({ rpn: rpn.rpn, priority: rpn.priority });
    
    const history = getHistory();
    const matches = findSimilarCases(
      {
        defectType: formData.defectDescription.substring(0, 20),
        product: formData.productInfo,
        location: formData.location
      },
      history
    );
    setSimilarItems(matches);
  };

  const startAnalysis = async () => {
    if (!formData.problemTitle || !formData.defectDescription) {
      setErrorMsg("請填寫問題標題與缺陷現象描述");
      return;
    }
    setErrorMsg("");
    setStep("analysis");
    setIsLoading(true);
    setCurrentMessage("");

    const { provider, apiKey } = getSettings();
    const fileContext = uploadedFiles.map(f => `檔案 [${f.name}]:\n${f.content}`).join("\n\n");
    
    const context = [
      formData.problemTitle && `【問題標題】${formData.problemTitle}`,
      formData.location && `【發生地點/線別】${formData.location}`,
      formData.detectionMethod && `【發現方式】${formData.detectionMethod}`,
      formData.impactScope && `【影響範圍】${formData.impactScope}`,
      formData.preliminaryCause && `【初步原因猜測】${formData.preliminaryCause}`,
      formData.defectDescription && `【缺陷現象詳細描述】\n${formData.defectDescription}`
    ].filter(Boolean).join("\n\n");
    
    const fullContext = `${context}\n\n[附件資料背景]\n${fileContext}`;
    
    setIsAnalyzing(true);
    setAnalysisProgress(20);

    try {
      runAssessment();
      setAnalysisProgress(40);
      
      let question = "";
      const callback = (chunk: string) => {
        question += chunk;
        setCurrentMessage(prev => prev + chunk);
      };

      if (provider === "gemini" && apiKey) {
        await generateGemini5Why(apiKey, fullContext, [], callback);
      } else if (provider === "agnes" && apiKey) {
        await generateAgnes5Why(apiKey, fullContext, [], callback);
      } else {
        setErrorMsg("請設定 API Key");
        setIsAnalyzing(false);
        setIsLoading(false);
        return;
      }
      
      setChatHistory([{ role: "assistant", content: question }]);
      setAnalysisProgress(100);
    } catch {
      setErrorMsg(provider === "gemini" ? "Gemini 連線失敗" : "Agnes AI 連線失敗");
    } finally {
      setIsAnalyzing(false);
      setIsLoading(false);
    }
  };

  const sendReply = async () => {
    if (!userInput.trim() || isLoading) return;

    const newHistory = [...chatHistory, { role: "user" as const, content: userInput }];
    setChatHistory(newHistory);
    setUserInput("");
    setIsLoading(true);
    setIsAnalyzing(true);
    setAnalysisProgress(60);
    setCurrentMessage("");

    const { provider, apiKey } = getSettings();
    const fileContext = uploadedFiles.map(f => `檔案 [${f.name}]:\n${f.content}`).join("\n\n");
    
    const context = [
      formData.problemTitle && `【問題標題】${formData.problemTitle}`,
      formData.location && `【發生地點/線別】${formData.location}`,
      formData.detectionMethod && `【發現方式】${formData.detectionMethod}`,
      formData.impactScope && `【影響範圍】${formData.impactScope}`,
      formData.preliminaryCause && `【初步原因猜測】${formData.preliminaryCause}`,
      formData.defectDescription && `【缺陷現象詳細描述】\n${formData.defectDescription}`
    ].filter(Boolean).join("\n\n");
    
    const fullContext = `${context}\n\n[附件資料背景]\n${fileContext}`;

    try {
      let answer = "";
      const callback = (chunk: string) => {
        answer += chunk;
        setCurrentMessage(prev => prev + chunk);
      };

      if (provider === "gemini" && apiKey) {
        await generateGemini5Why(apiKey, fullContext, newHistory, callback);
      } else if (provider === "agnes" && apiKey) {
        await generateAgnes5Why(apiKey, fullContext, newHistory, callback);
      } else {
        setErrorMsg("請檢查 API Key");
      }

      if (answer.includes("[FINISH_ANALYSIS]")) {
        setStep("final");
        generateReport([...newHistory, { role: "assistant", content: answer }]);
      } else {
        setChatHistory(prev => [...prev, { role: "assistant", content: answer }]);
      }
    } catch {
      setErrorMsg("分析過程中斷");
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  };

  const generateReport = async (history = chatHistory) => {
    setErrorMsg("");
    setReportContent("");
    setIsLoading(true);
    
    const { provider, apiKey } = getSettings();
    
    const analysisSummary = history
      .map(h => `${h.role === "user" ? "用戶回答" : "專家"}: ${h.content}`)
      .join("\n");

    const reportPrompt = buildEnhancedReportPrompt(analysisSummary, formData);

    let result = "";
    const callback = (chunk: string) => {
      result += chunk;
      setReportContent(prev => prev + chunk);
    };

    try {
      if (provider === "gemini" && apiKey) {
        await generateGeminiReport(apiKey, reportPrompt, callback);
      } else if (provider === "agnes" && apiKey) {
        await generateAgnesReport(apiKey, reportPrompt, callback);
      } else {
        setErrorMsg("生成失敗 - 請檢查 API Key");
      }
      
      const newItem = saveHistory({
        date: formData.date,
        productInfo: formData.productInfo,
        customerName: formData.customerName,
        defectQuantity: formData.defectQuantity,
        problemDescription: [formData.problemTitle, formData.defectDescription].filter(Boolean).join('\n'),
        generatedContent: result,
      });
      
      onReportGenerated(newItem);
    } catch (err: unknown) {
      console.error("Generate error:", err);
      setErrorMsg("報告生成失敗");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    const text = `---\ntitle: 8D Report - ${formData.productInfo}\ndate: ${formData.date}\ncustomer: ${formData.customerName}\nquantity: ${formData.defectQuantity}\n---\n\n# 8D Report\n${reportContent}`;
    navigator.clipboard.writeText(text);
    setErrorMsg("已複製到剪貼簿");
    setTimeout(() => setErrorMsg(""), 2000);
  };

  const downloadWord = () => {
    if (!reportContent) return;
    exportToDocx(reportContent, formData.productInfo || "8D_Report");
  };

  const downloadHtml = () => {
    if (!reportContent) return;
    exportToHtml(reportContent, {
      title: formData.productInfo || "8D_Report",
      metadata: {
        date: formData.date,
        customer: formData.customerName,
        product: formData.productInfo,
        defectQuantity: formData.defectQuantity,
        location: formData.location
      }
    });
  };

  const downloadPdf = () => {
    if (!reportContent) return;
    exportToPdf({
      title: formData.productInfo || "8D_Report",
      content: reportContent,
      metadata: { date: formData.date, customer: formData.customerName, product: formData.productInfo },
      brandSettings: { companyName: formData.customerName }
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] min-h-screen">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        
        {/* Step Indicator */}
        <div className="flex items-center gap-2 text-sm">
          {[
            { key: "input", label: "填寫資訊" },
            { key: "analysis", label: "原因分析" },
            { key: "final", label: "輸出報告" }
          ].map((s, i, arr) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className={`px-3 py-1.5 rounded ${
                step === s.key 
                  ? "bg-[var(--accent)] text-white" 
                  : step !== s.key && ["input","analysis","final"].indexOf(step) > i
                  ? "bg-green-600 text-white" 
                  : "bg-white border border-gray-200 text-[var(--text-secondary)]"
              }`}>
                {s.label}
              </div>
              {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-gray-400 opacity-40" />}
            </div>
          ))}
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMsg}</div>
            <button onClick={() => setErrorMsg("")} className="text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 1: INPUT FORM */}
        {step === "input" && (
          <div className="card p-6">
            <h1 className="text-lg font-semibold mb-1">8D 報告參數設定</h1>
            <p className="text-sm text-[var(--text-secondary)] mb-6">請填寫以下基礎資訊，以便進行後續分析</p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Problem Details */}
              <div className="space-y-5">
                <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wide">問題描述</h2>
                
                <div>
                  <label className="label">問題標題 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="problemTitle"
                    value={formData.problemTitle}
                    onChange={handleChange}
                    placeholder="例：XX產品表面刮傷不良率異常升高"
                    className="input"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">發生日期 <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      name="occurrenceTime"
                      value={formData.occurrenceTime}
                      onChange={handleChange}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">發生地點/線別</label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      placeholder="例：SMT線別A"
                      className="input"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="label">缺陷現象詳細描述 <span className="text-red-500">*</span></label>
                  <textarea
                    name="defectDescription"
                    value={formData.defectDescription}
                    onChange={handleChange}
                    placeholder="請詳細描述缺陷表現、嚴重程度、頻率等..."
                    className="textarea"
                    rows={5}
                  />
                </div>
                
                <div>
                  <label className="label">發現方式</label>
                  <input
                    type="text"
                    name="detectionMethod"
                    value={formData.detectionMethod}
                    onChange={handleChange}
                    placeholder="例：IQC進料檢驗 / 客戶驗貨"
                    className="input"
                  />
                </div>
                
                <div>
                  <label className="label">影響範圍</label>
                  <input
                    type="text"
                    name="impactScope"
                    value={formData.impactScope}
                    onChange={handleChange}
                    placeholder="例：批次 B2024001-B2024005 / 約2000 pcs"
                    className="input"
                  />
                </div>
                
                <div>
                  <label className="label">初步原因猜測</label>
                  <input
                    type="text"
                    name="preliminaryCause"
                    value={formData.preliminaryCause}
                    onChange={handleChange}
                    placeholder="例：刀具磨損 / 溫度設定不當"
                    className="input"
                  />
                </div>

                {/* File Upload */}
                <div>
                  <label className="label">上傳參考資料</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 hover:border-[var(--accent)] rounded p-4 cursor-pointer text-center transition-colors"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      multiple
                      className="hidden"
                      accept=".xlsx,.xls,.docx,.pdf,.txt"
                    />
                    <Upload className="w-5 h-5 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-[var(--text-secondary)]">
                      {isReadingFile ? "讀取中..." : "點擊或拖拽上傳文件"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">支援 Excel / Word / PDF / TXT</p>
                  </div>
                  
                  {uploadedFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {uploadedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileText className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                            <span className="truncate">{file.name}</span>
                          </div>
                          <button onClick={() => removeFile(idx)} className="text-gray-400 hover:text-red-500">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Basic Info */}
              <div className="space-y-5">
                <h2 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wide">基本資料</h2>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">發生日期</label>
                    <input type="date" name="date" value={formData.date} onChange={handleChange} className="input" />
                  </div>
                  <div>
                    <label className="label">不良數量 (pcs)</label>
                    <input type="number" name="defectQuantity" value={formData.defectQuantity} onChange={handleChange} className="input" />
                  </div>
                </div>
                
                <div>
                  <label className="label">產品/型號</label>
                  <input type="text" name="productInfo" value={formData.productInfo} onChange={handleChange} placeholder="輸入型號" className="input" />
                </div>
                
                <div>
                  <label className="label">客戶名稱</label>
                  <input type="text" name="customerName" value={formData.customerName} onChange={handleChange} placeholder="輸入客戶" className="input" />
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={startAnalysis}
                    disabled={isLoading || isReadingFile}
                    className="btn btn-primary w-full h-[42px] text-base"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    開始分析
                  </button>
                  <p className="text-xs text-[var(--text-secondary)] text-center mt-2">
                    系統將引導您進行 5-Why 根本原因分析
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: ANALYSIS */}
        {step === "analysis" && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Chat Panel */}
            <div className="xl:col-span-5 card flex flex-col" style={{ height: "calc(100vh - 180px)" }}>
              <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">原因分析對話</h2>
                  <p className="text-xs text-[var(--text-secondary)]">與專家系統互動</p>
                </div>
                {isAnalyzing && (
                  <div className="flex items-center gap-2 text-xs text-[var(--accent)]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {analysisProgress}%
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {isAnalyzing && (
                <div className="h-0.5 bg-gray-100 dark:bg-gray-800">
                  <div
                    className="h-full bg-[var(--accent)] transition-all duration-300"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
              )}

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] p-3 rounded text-sm whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-[var(--accent)] text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-[var(--text-primary)]"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                
                {currentMessage && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] p-3 rounded bg-gray-100 dark:bg-gray-800 text-sm whitespace-pre-wrap">
                      {currentMessage}
                      <Loader2 className="w-3 h-3 animate-spin mt-2 inline opacity-40 ml-1" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-[var(--border-color)]">
                <div className="relative">
                  <textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                    placeholder="輸入您的回答..."
                    className="w-full bg-white dark:bg-[var(--bg-surface)] border border-gray-300 dark:border-gray-600 rounded p-3 pr-12 text-sm resize-none focus:outline-none focus:border-[var(--accent)]"
                    rows={3}
                    disabled={isLoading}
                  />
                  <button
                    onClick={sendReply}
                    disabled={!userInput.trim() || isLoading}
                    className="absolute right-2 bottom-2 p-2 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-[var(--text-secondary)]">Enter 發送，Shift+Enter 換行</p>
                  <button
                    onClick={() => { setStep("final"); generateReport(); }}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    跳過分析，直接生成報告 →
                  </button>
                </div>
              </div>
            </div>

            {/* Preview Panel */}
            <div className="xl:col-span-7 space-y-4">
              {/* Risk Assessment */}
              {riskResult && (
                <div className="card p-4 flex items-center gap-4">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">風險評估</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    riskResult.priority === 'high' ? 'bg-red-100 text-red-700' :
                    riskResult.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {riskResult.priority === 'high' ? '高優先級' : riskResult.priority === 'medium' ? '中優先級' : '低優先級'}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)] ml-auto">
                    RPN: <span className="font-mono font-semibold">{riskResult.rpn}</span>
                  </span>
                </div>
              )}

              {/* Similar Cases */}
              {similarItems.length > 0 && (
                <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                    相關歷史案例 ({similarItems.length})
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {similarItems.slice(0, 3).map((c: any, i: number) => `#${c.caseId} (${c.similarity}%)`).join('、')}
                  </p>
                </div>
              )}

              {/* Report Preview */}
              <div className="card" style={{ height: "calc(100vh - 280px)", display: "flex", flexDirection: "column" }}>
                <div className="p-3 border-b border-[var(--border-color)] flex items-center justify-between">
                  <span className="text-sm font-medium">即時預覽</span>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                </div>
                <div className="flex-1 p-5 overflow-y-auto prose prose-sm max-w-none dark:prose-invert">
                  {reportContent ? (
                    <ReactMarkdown>{reportContent}</ReactMarkdown>
                  ) : (
                    <div className="text-center py-20 text-[var(--text-secondary)]">
                      <p className="text-sm">完成分析或點擊「直接生成」查看報告預覽</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: FINAL REPORT */}
        {step === "final" && (
          <div className="card overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-gray-50 dark:bg-[var(--bg-surface)]">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <h2 className="text-sm font-semibold">報告已完成</h2>
                  <p className="text-xs text-[var(--text-secondary)]">可匯出為不同格式</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep("input")} className="btn btn-ghost text-xs">
                  重新開始
                </button>
                <button onClick={copyToClipboard} className="btn btn-secondary text-xs">
                  複製內容
                </button>
                <button onClick={downloadWord} className="btn btn-secondary text-xs">
                  <FileDown className="w-3.5 h-3.5 mr-1.5" />Word
                </button>
                <button onClick={downloadHtml} className="btn btn-secondary text-xs">
                  <FileText className="w-3.5 h-3.5 mr-1.5" />HTML
                </button>
                <button onClick={downloadPdf} className="btn btn-primary text-xs">
                  <FileDown className="w-3.5 h-3.5 mr-1.5" />PDF
                </button>
              </div>
            </div>

            {/* Loading State */}
            {isLoading ? (
              <div className="p-20 flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
                <p className="text-sm text-[var(--text-secondary)]">正在生成報告...</p>
              </div>
            ) : reportContent ? (
              <div className="p-8 prose prose-sm max-w-none">
                <ReactMarkdown>{reportContent}</ReactMarkdown>
              </div>
            ) : (
              <div className="p-20 text-center text-[var(--text-secondary)]">
                <p className="text-sm">尚未生成報告，請先完成分析步驟</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
