import { useEffect, useState, useRef } from "react";
import { 
  FileText, CheckCircle, FileDown,
  Loader2, AlertCircle, ArrowRight, 
  Upload, X
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { saveAs } from "file-saver";
import { generate8D } from "@/lib/generate8D";
import type { ChatMessage } from "@/lib/types";
import { exportToDocx } from "@/lib/docxExporter";
import { exportToHtml } from "@/lib/htmlExporter";
import { exportToPdf } from "@/lib/pdfExporter";
import { ReportHistoryItem, saveHistory } from "@/lib/historyManager";
import { parseFile } from "@/lib/fileParser";
import { buildEnhanced5WhyPrompt, buildEnhancedReportPrompt } from "@/lib/tools/promptBuilder";
import { calculateRPN, findSimilarCases, SimilarCase } from "@/lib/tools/analysisTools";
import { getHistory } from "@/lib/historyManager";
import { errorText, kbBase, type CaseDetail, type KnowledgeDraft } from "@/lib/knowledgeWorkspace";
import type { ReportPosition } from "@/components/TaskTrail";

interface MainFormProps {
  onPositionChange: (position: ReportPosition) => void;
  projectAgent: string | null | undefined;
  onAgentUnavailable: () => void;
  onReportGenerated: (item: ReportHistoryItem) => void;
  selectedHistory: ReportHistoryItem | null;
  caseContext?: CaseDetail;
  caseId?: string;
  onSaveCaseDraft?: (id: string, draft: KnowledgeDraft) => Promise<void>;
}

type Step = "input" | "analysis" | "final";
type ReferenceFile = { name: string; content: string; source?: string };

export default function MainForm({ onReportGenerated, selectedHistory, caseContext, caseId, onSaveCaseDraft, projectAgent, onAgentUnavailable, onPositionChange }: MainFormProps) {
  const [step, setStep] = useState<Step>(selectedHistory ? "final" : "input");
  const caseDate = caseContext?.category === "capa" ? "" : caseContext?.day;
  const [formData, setFormData] = useState({
    problemTitle: selectedHistory?.problemDescription || caseContext?.title || "",
    occurrenceTime: selectedHistory?.date ?? caseDate ?? new Date().toISOString().split("T")[0],
    location: "",
    defectDescription: "",
    detectionMethod: "",
    impactScope: "",
    preliminaryCause: "",
    date: selectedHistory?.date ?? caseDate ?? new Date().toISOString().split("T")[0],
    defectQuantity: selectedHistory?.defectQuantity ?? 1,
    productInfo: selectedHistory?.productInfo || (caseContext?.products.length === 1 ? caseContext.products[0] : ""),
    productBatch: selectedHistory?.productBatch || "",
    customerName: selectedHistory?.customerName || "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [reportContent, setReportContent] = useState<string>(selectedHistory?.generatedContent || "");
  const [errorMsg, setErrorMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);
  const reportReady = !isLoading && Boolean(reportContent.trim());

  useEffect((): void => {
    onPositionChange({ step, saved: savedDraft, ready: reportReady });
  }, [onPositionChange, step, savedDraft, reportReady]);

  // Analysis state
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [userInput, setUserInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<ReferenceFile[]>([]);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Assessment state
  const [riskResult, setRiskResult] = useState<{ rpn: number; priority: string } | null>(null);
  const [similarItems, setSimilarItems] = useState<SimilarCase[]>([]);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (step === "analysis") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, currentMessage, step]);

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

  const addCaseEvidence = async (file: string): Promise<void> => {
    if (!file || isReadingFile) return;
    setErrorMsg("");
    setIsReadingFile(true);
    try {
      const params = new URLSearchParams({ file, preview: "1" });
      const response = await fetch(kbBase + "file?" + params, { cache: "no-store" });
      if (!response.ok || Number(response.headers.get("content-length")) > 20_000_000) {
        throw new Error("無法讀取附件，或附件超過 20 MB。");
      }
      const content = (await response.text()).slice(0, 300_000);
      setUploadedFiles((previous: ReferenceFile[]): ReferenceFile[] => (
        previous.some((entry: ReferenceFile): boolean => entry.source === file)
          ? previous
          : [...previous, { name: file.split("/").at(-1) ?? file, content, source: file }]
      ));
    } catch (error: unknown) {
      setErrorMsg(errorText(error));
    } finally {
      setIsReadingFile(false);
    }
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
      setErrorMsg("填寫問題標題和缺陷描述。");
      return;
    }
    setErrorMsg("");
    setStep("analysis");
    setIsLoading(true);
    setCurrentMessage("");

    const fileContext = uploadedFiles.map(f => `檔案 [${f.name}]:\n${f.content}`).join("\n\n");
    
    const context = [
      formData.problemTitle && `【問題標題】${formData.problemTitle}`,
      formData.location && `【發生地點或產線】${formData.location}`,
      formData.detectionMethod && `【發現方式】${formData.detectionMethod}`,
      formData.impactScope && `【影響範圍】${formData.impactScope}`,
      formData.preliminaryCause && `【可能原因】${formData.preliminaryCause}`,
      formData.defectDescription && `【缺陷描述】\n${formData.defectDescription}`
    ].filter(Boolean).join("\n\n");
    
    const fullContext = `${context}\n\n[參考附件]\n${fileContext}`;
    
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

      await generate8D(projectAgent, buildEnhanced5WhyPrompt(fullContext, []), callback, onAgentUnavailable);
      
      setChatHistory([{ role: "assistant", content: question }]);
      setAnalysisProgress(100);
    } catch (error: unknown) {
      setErrorMsg(errorText(error));
      setStep("input");
    } finally {
      setCurrentMessage("");
      setIsAnalyzing(false);
      setIsLoading(false);
    }
  };

  const sendReply = async () => {
    if (!userInput.trim() || isLoading) return;

    const newHistory = [...chatHistory, { role: "user" as const, content: userInput }];
    setErrorMsg("");
    setChatHistory(newHistory);
    setUserInput("");
    setIsLoading(true);
    setIsAnalyzing(true);
    setAnalysisProgress(60);
    setCurrentMessage("");

    const fileContext = uploadedFiles.map(f => `檔案 [${f.name}]:\n${f.content}`).join("\n\n");
    
    const context = [
      formData.problemTitle && `【問題標題】${formData.problemTitle}`,
      formData.location && `【發生地點或產線】${formData.location}`,
      formData.detectionMethod && `【發現方式】${formData.detectionMethod}`,
      formData.impactScope && `【影響範圍】${formData.impactScope}`,
      formData.preliminaryCause && `【可能原因】${formData.preliminaryCause}`,
      formData.defectDescription && `【缺陷描述】\n${formData.defectDescription}`
    ].filter(Boolean).join("\n\n");
    
    const fullContext = `${context}\n\n[參考附件]\n${fileContext}`;

    try {
      let answer = "";
      const callback = (chunk: string) => {
        answer += chunk;
        setCurrentMessage(prev => prev + chunk);
      };

      await generate8D(projectAgent, buildEnhanced5WhyPrompt(fullContext, newHistory), callback, onAgentUnavailable);

      if (answer.includes("[FINISH_ANALYSIS]")) {
        setStep("final");
        await generateReport([...newHistory, { role: "assistant", content: answer }]);
      } else {
        setChatHistory(prev => [...prev, { role: "assistant", content: answer }]);
      }
    } catch (error: unknown) {
      setChatHistory(chatHistory);
      setUserInput(userInput);
      setErrorMsg(errorText(error));
    } finally {
      setCurrentMessage("");
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  };

  const generateReport = async (history: ChatMessage[] = chatHistory): Promise<void> => {
    setSavedDraft(false);
    setErrorMsg("");
    setReportContent("");
    setIsLoading(true);
    
    
    const analysisSummary = history
      .map(h => `${h.role === "user" ? "使用者回答" : "專家"}: ${h.content}`)
      .join("\n");

    const references = uploadedFiles.map((file: ReferenceFile): string => (
      file.name + "\n" + file.content
    )).join("\n\n");
    const reportPrompt = buildEnhancedReportPrompt(analysisSummary, formData) +
      (references ? "\n\n## 參考附件\n" + references : "");

    let result = "";
    const callback = (chunk: string) => {
      result += chunk;
      setReportContent(prev => prev + chunk);
    };

    try {
      await generate8D(projectAgent, reportPrompt, callback, onAgentUnavailable);
      
      if (!result.trim()) {
        setErrorMsg("模型沒有傳回報告。請重試。");
        return;
      }
      const newItem = saveHistory({
        caseId,
        date: formData.date,
        productInfo: formData.productInfo,
        productBatch: formData.productBatch,
        customerName: formData.customerName,
        defectQuantity: formData.defectQuantity,
        problemDescription: [formData.problemTitle, formData.defectDescription].filter(Boolean).join('\n'),
        generatedContent: result,
      });
      
      onReportGenerated(newItem);
    } catch (err: unknown) {
      setErrorMsg(errorText(err));
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
        productBatch: formData.productBatch,
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

  const knowledgeDraft = (): KnowledgeDraft | null => {
    const markdown = reportContent.trim();
    if (isLoading || !markdown) return null;
    return {
      format: "8d-creator.quality-kb",
      version: 1,
      fields: {
        date: formData.date,
        product: formData.productInfo,
        batch: formData.productBatch,
        customer: formData.customerName,
        defectQuantity: String(formData.defectQuantity),
        problem: [formData.problemTitle, formData.defectDescription].filter(Boolean).join("\n"),
      },
      markdown,
    };
  };

  const downloadKnowledgeDraft = (): void => {
    const draft = knowledgeDraft();
    if (!draft) return;
    const file = new Blob([JSON.stringify(draft)], { type: "application/json;charset=utf-8" });
    if (file.size > 2_000_000) {
      setErrorMsg("知識庫草稿不得超過 2 MB");
      return;
    }
    saveAs(file, "8D-kb-" + Date.now() + ".json");
  };

  const saveCaseDraft = async (): Promise<void> => {
    const draft = knowledgeDraft();
    if (!caseId || !onSaveCaseDraft || !draft || savingDraft) return;
    setSavingDraft(true);
    setSavedDraft(false);
    setErrorMsg("");
    try {
      await onSaveCaseDraft(caseId, draft);
      setSavedDraft(true);
    } catch (error: unknown) {
      setErrorMsg(errorText(error));
    } finally {
      setSavingDraft(false);
    }
  };

  const startManualDraft = (): void => {
    setReportContent((previous: string): string => previous || [
      "# 8D 報告",
      "## D1: 團隊成立", "## D2: 問題描述", "## D3: 臨時遏制措施", "## D4: 根本原因分析",
      "## D5: 矯正措施", "## D6: 預防措施", "## D7: 措施驗證", "## D8: 團隊慶祝",
    ].join("\n\n"));
    setEditing(true);
    setStep("final");
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] h-full">
      <div className="max-w-7xl mx-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6">
        

        {/* Error Message */}
        {errorMsg && (
          <div className="flex items-start gap-3 p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 shadow-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">{errorMsg}</div>
            <button onClick={() => setErrorMsg("")} className="text-red-400 hover:text-red-600 p-1 min-h-[32px] min-w-[32px] flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 1: INPUT FORM */}
        {step === "input" && (
          <div className="card p-4 sm:p-6 space-y-6">
            <div>
              <h1 className="text-base sm:text-lg font-semibold tracking-tight text-[var(--text-primary)] mb-1">填寫 8D 報告資料</h1>
              <p className="text-[13px] sm:text-sm text-[var(--text-secondary)]">填寫必填欄位，再選取「開始分析」。</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              {/* Left: Problem Details */}
              <div className="space-y-4 sm:space-y-5">
                <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider pb-1 border-b border-[var(--border-color)]">問題描述</h2>
                
                <div>
                  <label className="label">問題標題 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="problemTitle"
                    value={formData.problemTitle}
                    onChange={handleChange}
                    placeholder="例：產品表面刮傷增加"
                    className="input"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <label className="label">發生地點或產線</label>
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
                  <label className="label">缺陷描述 <span className="text-red-500">*</span></label>
                  <textarea
                    name="defectDescription"
                    value={formData.defectDescription}
                    onChange={handleChange}
                    placeholder="例：刮傷位於右側邊緣，長約 5 mm"
                    className="textarea"
                    rows={4}
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
                  <label className="label">可能原因</label>
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
                  <label className="label">參考附件</label>
                  {caseContext && <label className="label mb-2 block">從案件加入參考附件
                    <select aria-label="從案件加入參考附件" value="" className="input mt-1 w-full" disabled={isReadingFile}
                      onChange={(event): void => void addCaseEvidence(event.target.value)}>
                      <option value="">選擇文字或 Office 附件</option>
                      {caseContext.evidence.filter((file: string): boolean => /\.(txt|csv|docx|xlsx?|xlsm)$/i.test(file))
                        .map((file: string) => <option key={file} value={file}>{file.split("/").at(-1)}</option>)}
                    </select>
                    <span className="mt-1 block text-xs text-[var(--text-secondary)]">使用 AI 分析時，系統會將已加入的附件文字傳給目前的 AI 服務。</span>
                  </label>}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[var(--border-color)] hover:border-[var(--accent)] rounded-lg p-5 cursor-pointer text-center transition-colors bg-[var(--bg-base)]/50"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      multiple
                      className="hidden"
                      accept=".xlsx,.xls,.docx,.pdf,.txt"
                    />
                    <Upload className="w-6 h-6 mx-auto mb-2 text-[var(--accent)] opacity-80" />
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {isReadingFile ? "讀取中..." : "選取檔案，或將檔案拖到此處"}
                    </p>
                    <p className="text-[13px] text-[var(--text-secondary)] mt-1">支援 Excel / Word / PDF / TXT</p>
                  </div>
                  
                  {uploadedFiles.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {uploadedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-lg text-sm">
                          <div className="flex items-center gap-2 overflow-hidden min-w-0">
                            <FileText className="w-4 h-4 text-[var(--accent)] shrink-0" />
                            <span className="truncate text-[var(--text-primary)] font-medium">{file.name}</span>
                          </div>
                          <button 
                            onClick={() => removeFile(idx)} 
                            className="text-[var(--text-secondary)] hover:text-red-500 transition-colors p-1 min-w-[32px] min-h-[32px] flex items-center justify-center"
                            aria-label="移除檔案"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Basic Info */}
              <div className="space-y-4 sm:space-y-5">
                <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider pb-1 border-b border-[var(--border-color)]">產品與客戶資料</h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">發生日期</label>
                    <input type="date" name="date" value={formData.date} onChange={handleChange} className="input" />
                  </div>
                  <div>
                    <label className="label">不良品數量（件）</label>
                    <input type="number" name="defectQuantity" value={formData.defectQuantity} onChange={handleChange} className="input" />
                  </div>
                </div>
                
                <div>
                  <label className="label">產品或型號</label>
                  <input type="text" name="productInfo" value={formData.productInfo} onChange={handleChange} placeholder="輸入型號" className="input" />
                </div>
                
                <div>
                  <label className="label">產品批號</label>
                  <input type="text" name="productBatch" value={formData.productBatch} onChange={handleChange} placeholder="例：B2026-0813-01" className="input" />
                </div>
                
                <div>
                  <label className="label">客戶名稱</label>
                  <input type="text" name="customerName" value={formData.customerName} onChange={handleChange} placeholder="輸入客戶名稱" className="input" />
                </div>

                <div className="pt-4 sm:pt-6 border-t border-[var(--border-color)] space-y-2">
                  <button
                    onClick={startAnalysis}
                    disabled={isLoading || isReadingFile || projectAgent === undefined}
                    className="btn btn-primary w-full min-h-[46px] text-base font-semibold shadow-sm"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    開始分析
                  </button>
                  {caseId && <button type="button" className="btn btn-secondary mt-2 w-full" onClick={startManualDraft}>
                    手寫 8D 草稿
                  </button>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: ANALYSIS */}
        {step === "analysis" && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6">
            {/* Chat Panel */}
            <div className="xl:col-span-5 card flex flex-col h-[520px] xl:h-[calc(100vh-170px)] overflow-hidden">
              <div className="p-3.5 sm:p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-surface)]">
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">5-Why 原因分析</h2>
                  <p className="text-[13px] text-[var(--text-secondary)]">回答問題，逐步查找根本原因。</p>
                </div>
                {isAnalyzing && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-1 rounded">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {analysisProgress}%
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {isAnalyzing && (
                <div className="h-1 bg-[var(--border-color)] w-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] transition-all duration-300"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
              )}

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 bg-[var(--bg-base)]/40">
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[90%] sm:max-w-[85%] p-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-[var(--accent)] text-white shadow-xs"
                        : "bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-xs"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                
                {currentMessage && (
                  <div className="flex justify-start">
                    <div className="max-w-[90%] sm:max-w-[85%] p-3 rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] text-sm leading-relaxed whitespace-pre-wrap shadow-xs">
                      {currentMessage}
                      <Loader2 className="w-3.5 h-3.5 animate-spin mt-2 inline opacity-50 ml-1.5 text-[var(--accent)]" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-3.5 sm:p-4 border-t border-[var(--border-color)] bg-[var(--bg-surface)] space-y-2">
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
                    placeholder="輸入回答"
                    className="w-full bg-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg p-3 pr-12 text-sm resize-none focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all"
                    rows={2}
                    disabled={isLoading}
                  />
                  <button
                    onClick={sendReply}
                    disabled={!userInput.trim() || isLoading}
                    className="absolute right-2.5 bottom-2.5 min-w-[36px] min-h-[36px] flex items-center justify-center bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] active:scale-95 disabled:opacity-40 transition-all shadow-xs"
                    aria-label="傳送回答"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5">
                  <p className="text-xs text-[var(--text-secondary)]">按 Enter 傳送。按 Shift+Enter 換行。</p>
                  <button
                    onClick={() => { setStep("final"); generateReport(); }}
                    disabled={isLoading || projectAgent === undefined}
                    className="text-xs sm:text-[13px] font-medium text-[var(--accent)] hover:underline py-1"
                  >
                    跳過分析並產生報告
                  </button>
                </div>
              </div>
            </div>

            {/* Preview Panel */}
            <div className="xl:col-span-7 space-y-4">
              {/* Risk Assessment */}
              {riskResult && (
                <div className="card p-3.5 sm:p-4 flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-[var(--text-secondary)]">風險評估</span>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                    riskResult.priority === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                    riskResult.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                    'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  }`}>
                    {riskResult.priority === 'high' ? '高優先順序' : riskResult.priority === 'medium' ? '中優先順序' : '低優先順序'}
                  </span>
                  <span className="text-sm text-[var(--text-secondary)] ml-auto">
                    RPN: <span className="font-mono font-bold text-[var(--text-primary)]">{riskResult.rpn}</span>
                  </span>
                </div>
              )}

              {/* Similar Cases */}
              {similarItems.length > 0 && (
                <div className="card p-3.5 sm:p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">
                    相似案件 ({similarItems.length})
                  </p>
                  <p className="text-xs sm:text-[13px] text-blue-600 dark:text-blue-400">
                    {similarItems.slice(0, 3).map((c: SimilarCase) => `#${c.caseId} (${c.similarity}%)`).join('、')}
                  </p>
                </div>
              )}

              {/* Report Preview */}
              <div className="card h-[400px] xl:h-[calc(100vh-270px)] flex flex-col overflow-hidden">
                <div className="p-3 sm:p-3.5 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-surface)]">
                  <span className="text-sm font-semibold">報告預覽</span>
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                </div>
                <div className="flex-1 p-4 sm:p-6 overflow-y-auto prose prose-sm max-w-none dark:prose-invert">
                  {reportContent ? (
                    <ReactMarkdown>{reportContent}</ReactMarkdown>
                  ) : (
                    <div className="text-center py-16 text-[var(--text-secondary)]">
                      <p className="text-sm">產生報告後，此處會顯示預覽。</p>
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
            {/* Header Toolbar */}
            <div className="p-4 border-b border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--bg-surface)]">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">8D 報告</h2>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 [&>button]:whitespace-nowrap">
                {caseId && <>
                  <button onClick={(): void => setEditing(!editing)} disabled={isLoading} className="btn btn-secondary text-sm">
                    {editing ? "預覽草稿" : "編輯草稿"}
                  </button>
                  <button onClick={(): void => void saveCaseDraft()} disabled={isLoading || savingDraft || !reportContent.trim()} className="btn btn-primary text-sm">
                    儲存至案件
                  </button>
                </>}
                <button onClick={() => setStep("input")} className="btn btn-ghost text-sm flex-1 sm:flex-none">
                  重新填寫
                </button>
                <button onClick={copyToClipboard} className="btn btn-secondary text-sm flex-1 sm:flex-none">
                  複製報告
                </button>
                <button onClick={downloadWord} className="btn btn-secondary text-sm flex-1 sm:flex-none">
                  <FileDown className="w-4 h-4 mr-1.5" />匯出 Word
                </button>
                <button onClick={downloadHtml} className="btn btn-secondary text-sm flex-1 sm:flex-none">
                  <FileText className="w-4 h-4 mr-1.5" />匯出 HTML
                </button>
                <button onClick={downloadKnowledgeDraft} disabled={isLoading || !reportContent.trim()} className="btn btn-secondary text-sm flex-1 sm:flex-none disabled:opacity-50">
                  <FileDown className="w-4 h-4 mr-1.5" />匯出知識庫草稿
                </button>
                <button onClick={downloadPdf} className="btn btn-primary text-sm w-full sm:w-auto font-semibold">
                  <FileDown className="w-4 h-4 mr-1.5" />匯出 PDF
                </button>
              </div>
            </div>
            {savedDraft && <p role="status" className="px-4 pt-3 text-sm">已儲存 8D 草稿。</p>}

            {/* Loading State */}
            {isLoading ? (
              <div className="p-16 flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
                <p className="text-sm text-[var(--text-secondary)]">正在產生 8D 報告。</p>
              </div>
            ) : editing ? (
              <div className="p-4">
                <label className="label block">8D 草稿
                  <textarea rows={16} className="input mt-1 min-h-72 w-full font-mono" value={reportContent} onChange={(event): void => {
                    setReportContent(event.target.value);
                    setSavedDraft(false);
                  }} />
                </label>
              </div>
            ) : reportContent ? (
              <div className="p-4 sm:p-8 prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{reportContent}</ReactMarkdown>
              </div>
            ) : (
              <div className="p-16 text-center text-[var(--text-secondary)]">
                <p className="text-sm">目前沒有報告。請返回分析步驟。</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
