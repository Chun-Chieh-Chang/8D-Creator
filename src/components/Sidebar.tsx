import { 
  FileText, Trash2, Clock, History,
  ShieldCheck, Key, LayoutTemplate,
  BoxSelect, Globe
} from "lucide-react";
import { ReportHistoryItem } from "@/lib/historyManager";
import { useEffect, useState } from "react";

interface SidebarProps {
  onSelectHistory: (report: ReportHistoryItem) => void;
  history: ReportHistoryItem[];
  onDeleteHistory: (id: string) => void;
  onNewReport?: () => void;
}

export default function Sidebar({ 
  onSelectHistory, 
  history = [], 
  onDeleteHistory, 
  onNewReport
}: SidebarProps) {
  const [provider, setProvider] = useState<"ollama" | "gemini">("ollama");
  const [apiKey, setApiKey] = useState("");
  const [templateMode, setTemplateModeState] = useState<"standard" | "custom" | "uploaded">("standard");

  useEffect(() => {
    const loadConfig = async () => {
      // 1. Load from localStorage first
      const savedProvider = localStorage.getItem("ai-provider");
      const savedKey = localStorage.getItem("gemini-api-key") || "";
      const savedTemplateMode = (localStorage.getItem("8d-template-mode") as "standard" | "custom" | "uploaded") || "standard";
      
      if (savedProvider === "ollama" || savedProvider === "gemini") {
        setProvider(savedProvider as "ollama" | "gemini");
      }
      setApiKey(savedKey);
      setTemplateModeState(savedTemplateMode);

      // 2. Try to override/init from config.json
      try {
        const response = await fetch('/config.json');
        if (response.ok) {
          const config = await response.json();
          if (config.geminiApiKey && !savedKey) {
            setApiKey(config.geminiApiKey);
            localStorage.setItem("gemini-api-key", config.geminiApiKey);
          }
          if (config.provider) {
            setProvider(config.provider);
            localStorage.setItem("ai-provider", config.provider);
          }
        }
      } catch {
        // Silent fail
      }
    };

    loadConfig();
  }, []);

  const handleProviderChange = (p: "ollama" | "gemini") => {
    setProvider(p);
    localStorage.setItem("ai-provider", p);
  };

  const handleKeyChange = (k: string) => {
    setApiKey(k);
    localStorage.setItem("gemini-api-key", k);
  };

  const handleTemplateModeChange = (mode: "standard" | "custom" | "uploaded") => {
    setTemplateModeState(mode);
    localStorage.setItem("8d-template-mode", mode);
    window.dispatchEvent(new Event("templateModeChanged"));
  };

  return (
    <aside className="w-80 border-r border-(--border-color) bg-white flex flex-col h-screen sticky top-0">
      {/* Logo Section */}
      <div className="p-6 border-b border-(--border-color) flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-linear-to-br from-(--accent) to-[#2563EB] flex items-center justify-center text-white shadow-lg ring-4 ring-(--accent)/10">
          <FileText className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-(--text-primary)">AI 8D Generator</h1>
          <p className="text-[10px] font-bold text-(--text-secondary) tracking-widest uppercase opacity-60">Quality Pro</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-8 mt-2 scrollbar-premium">
        
        {/* New Report Button */}
        <button 
          onClick={() => onNewReport ? onNewReport() : window.location.reload()}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-(--accent) hover:bg-(--accent-hover) text-white rounded-xl font-bold text-[14px] shadow-lg shadow-(--accent)/20 transition-all hover:scale-[1.02] active:scale-[0.98] group"
        >
          <FileText className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          開啟新報告
        </button>

        {/* AI Provider Section */}
        <div className="px-3 py-4 bg-(--bg-base)/50 rounded-2xl border border-(--border-color)/50 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-(--accent)" />
            <h2 className="text-[11px] font-bold text-(--text-secondary) tracking-widest uppercase">AI Provider</h2>
          </div>
          
          <div className="flex p-1 bg-(--bg-base) rounded-xl border border-(--border-color)">
            <button 
              onClick={() => handleProviderChange("ollama")}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
                provider === "ollama" ? "bg-white shadow-sm text-(--accent)" : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              <BoxSelect className="w-3.5 h-3.5" /> Ollama
            </button>
            <button 
              onClick={() => handleProviderChange("gemini")}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
                provider === "gemini" ? "bg-white shadow-sm text-(--accent)" : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> Gemini
            </button>
          </div>

          {provider === "gemini" && (
            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
              <div className="p-3 bg-(--accent)/5 rounded-xl border border-(--accent)/10">
                <p className="text-[12px] text-(--text-secondary) leading-relaxed">
                  請前往 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-(--accent) font-bold hover:underline decoration-2 underline-offset-4">Google AI Studio</a> 免費建立您的 API Key。
                </p>
              </div>
              <div className="relative group/input">
                <input
                  type="password"
                  placeholder="Paste your Gemini API Key..."
                  className="premium-input pl-11 h-12 text-[14px] w-full px-3 py-2 bg-white border border-(--border-color) rounded-lg focus:ring-2 focus:ring-(--accent)/10 focus:border-(--accent) outline-none transition-all"
                  value={apiKey}
                  onChange={(e) => handleKeyChange(e.target.value)}
                />
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-(--accent)" />
              </div>
            </div>
          )}
        </div>

        {/* Template Mode Section */}
        <div className="px-3 py-4 bg-(--bg-base)/50 rounded-2xl border border-(--border-color)/50 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <LayoutTemplate className="w-4 h-4 text-(--accent)" />
            <h2 className="text-[11px] font-bold text-(--text-secondary) tracking-widest uppercase">Template Mode</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            {[
              { id: "standard", label: "AI 標準模板", desc: "標準 8D 報告格式" },
              { id: "custom", label: "AI 自定義模板", desc: "根據您的要求生成" },
              { id: "uploaded", label: "上傳我的模板", desc: "使用現有檔案結構" }
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => handleTemplateModeChange(mode.id as "standard" | "custom" | "uploaded")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  templateMode === mode.id 
                    ? "bg-white border-(--accent) shadow-sm ring-2 ring-(--accent)/5" 
                    : "bg-(--bg-base)/30 border-transparent hover:border-(--border-color)"
                }`}
              >
                <div className="text-[13px] font-bold text-(--text-primary)">{mode.label}</div>
                <div className="text-[11px] text-(--text-secondary)">{mode.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* History Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-(--text-secondary)" />
              <h2 className="text-[11px] font-bold text-(--text-secondary) tracking-widest uppercase">報告紀錄</h2>
            </div>
            <span className="px-2 py-0.5 bg-(--bg-base) rounded-full text-[10px] font-bold text-(--text-secondary)">
              {history?.length || 0}
            </span>
          </div>

          <div className="space-y-2">
            {(!history || history.length === 0) ? (
              <div className="px-4 py-8 bg-(--bg-base)/30 rounded-2xl border border-dashed border-(--border-color) flex flex-col items-center justify-center text-center gap-3">
                <Clock className="w-8 h-8 text-(--text-secondary) opacity-20" />
                <p className="text-[12px] text-(--text-secondary) px-4">尚無報告紀錄，快來生成您的第一份 8D 報告吧！</p>
              </div>
            ) : (
              history.map((report) => (
                <div 
                  key={report.id}
                  onClick={() => onSelectHistory(report)}
                  className="group p-3 hover:bg-white rounded-xl border border-transparent hover:border-(--border-color) hover:shadow-sm transition-all cursor-pointer flex justify-between items-center"
                >
                  <div className="min-w-0 pr-4">
                    <div className="text-[13px] font-bold text-(--text-primary) truncate mb-0.5">
                      {report?.productInfo || "未命名報告"}
                    </div>
                    <div className="text-[10px] text-(--text-secondary) font-bold uppercase truncate">
                      {report.date}
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteHistory(report.id);
                    }}
                    className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
