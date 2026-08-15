import { 
  FileText, Trash2, Clock, History,
  Sun, Moon, Search,
  Info, ArrowRight, Palette, Cpu
} from "lucide-react";
import { ReportHistoryItem } from "@/lib/historyManager";
import { useEffect, useState } from "react";
import BrandSettingsPanel from "./BrandSettingsPanel";
import AISettingsModal from "./AISettingsModal";
import { aiService } from "@/lib/ai_service";

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
  const [provider, setProvider] = useState<"agnes" | "gemini">("agnes");
  const [model, setModel] = useState("");
  const [theme, setThemeState] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [showBrandSettings, setShowBrandSettings] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark";
    const isDark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const currentTheme = isDark ? "dark" : "light";
    requestAnimationFrame(() => {
      setThemeState(currentTheme);
      setMounted(true);
    });
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.classList.toggle("light", !isDark);
  }, []);

  useEffect(() => {
    // 唯讀顯示目前引擎狀態（設定唯一入口為 AISettingsModal）
    requestAnimationFrame(() => {
      const conf = aiService.getConfig();
      setProvider(conf.provider);
      setModel(aiService.getEffectiveModel(conf));
    });
  }, []);

  const refreshConfig = () => {
    const conf = aiService.getConfig();
    setProvider(conf.provider);
    setModel(aiService.getEffectiveModel(conf));
  };

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    document.documentElement.classList.toggle("light", newTheme === "light");
  };

  const filteredHistory = history.filter((report) => {
    const matchesSearch = !searchQuery || 
      report.productInfo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.problemDescription?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCustomer = !filterCustomer || report.customerName === filterCustomer;
    return matchesSearch && matchesCustomer;
  });

  return (
    <>
      <aside className="w-72 border-r border-[var(--border-color)] bg-[var(--bg-surface)] flex flex-col h-full sticky top-0">
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--accent)] flex items-center justify-center text-white">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">8D 報告系統</h1>
              <p className="text-[13px] text-[var(--text-secondary)]">Quality Management</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowBrandSettings(true)}
              className="p-2 hover:bg-[var(--bg-base)] rounded text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
              title="品牌設定"
            >
              <Palette className="w-4 h-4" />
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-[var(--bg-base)] rounded text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
            >
              {mounted ? (
                theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />
              ) : <div className="w-4 h-4" />}
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5 mt-4">
          
          {/* New Report */}
          <button
            onClick={() => onNewReport ? onNewReport() : window.location.reload()}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[var(--accent)] text-white rounded text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
          >
            <FileText className="w-4 h-4" />
            新報告
          </button>

          {/* Help */}
          <details className="bg-[var(--bg-base)] rounded border border-[var(--border-color)]">
            <summary className="flex items-center justify-between cursor-pointer p-3 text-sm font-medium text-[var(--text-primary)]">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[var(--accent)]" />
                使用說明
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[var(--text-secondary)] transition-transform group-open:rotate-90" />
            </summary>
            <div className="px-3 pb-3 space-y-2 text-[13px] text-[var(--text-secondary)] border-t border-[var(--border-color)] pt-2 mt-1">
              <ul className="space-y-1 list-disc list-inside">
                <li>填寫問題描述後開始分析</li>
                <li>與專家對話進行 5-Why 推導</li>
                <li>完成分析後生成完整報告</li>
                <li>支援 Word / HTML / PDF 匯出</li>
              </ul>
            </div>
          </details>

          {/* AI Engine Status (唯讀顯示，設定唯一入口為 AISettingsModal) */}
          <div className="space-y-3">
            <h2 className="text-[13px] font-medium text-[var(--text-secondary)] uppercase tracking-wide">AI 引擎設定</h2>

            <div className="flex items-center justify-between gap-2 p-3 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-lg">
              <div className="flex items-center gap-2 min-w-0">
                <Cpu className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate">
                    {provider === "gemini" ? "Google Gemini" : "Agnes AI"}
                  </p>
                  <p className="text-[13px] text-[var(--text-secondary)] truncate" title={model}>
                    {model || "未設定"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAISettings(true)}
                className="shrink-0 px-3 py-1.5 rounded text-[13px] font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
              >
                設定
              </button>
            </div>
          </div>

          {/* History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[var(--text-secondary)]" />
                <h2 className="text-[13px] font-medium text-[var(--text-secondary)] uppercase tracking-wide">報告紀錄</h2>
              </div>
              <span className="text-[13px] text-[var(--text-primary)] bg-[var(--bg-base)] border border-[var(--border-color)] px-2.5 py-0.5 rounded-full font-medium">
                {history.length}
              </span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder="搜尋..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-9 text-[13px] py-1.5"
              />
            </div>

            {/* Customer Filter */}
            <select
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              className="input text-[13px] py-1.5 appearance-none"
            >
              <option value="">所有客戶</option>
              {Array.from(new Set(history.map(h => h.customerName).filter(Boolean)))
                .map((customer: string) => (
                  <option key={customer} value={customer}>{customer}</option>
                ))}
            </select>

            {/* History List */}
            <div className="space-y-1.5">
              {filteredHistory.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-secondary)] text-[13px]">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>{history.length === 0 ? "尚無報告紀錄" : "無符合搜尋結果"}</p>
                </div>
              ) : (
                filteredHistory.map((report) => (
                  <div
                    key={report.id}
                    onClick={() => onSelectHistory(report)}
                    className="group p-3 hover:bg-[var(--bg-base)] rounded border border-transparent hover:border-[var(--border-color)] cursor-pointer transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium truncate">{report.productInfo || "未命名報告"}</p>
                        <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">{report.date}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteHistory(report.id);
                        }}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 rounded transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Author Info */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-surface)]">
          <p className="text-[13px] text-[var(--text-secondary)] text-center opacity-70">
            Developed by Wesley Chang @Mouldex, Aug-2026.
          </p>
        </div>
      </aside>

      {/* Brand Settings Modal */}
      {showBrandSettings && (
        <BrandSettingsPanel onClose={() => setShowBrandSettings(false)} />
      )}

      {/* AI Engine Settings Modal */}
      {showAISettings && (
        <AISettingsModal
          onClose={() => setShowAISettings(false)}
          onSaved={refreshConfig}
        />
      )}
    </>
  );
}
