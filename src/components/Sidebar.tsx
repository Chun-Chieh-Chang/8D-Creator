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
  projectAgent: string | null | undefined;
  onOpenMap: () => void;
  onSelectHistory: (report: ReportHistoryItem) => void;
  history: ReportHistoryItem[];
  onDeleteHistory: (id: string) => void;
  onNewReport?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ 
  projectAgent,
  onOpenMap,
  onSelectHistory, 
  history = [], 
  onDeleteHistory, 
  onNewReport,
  isOpen = false,
  onClose
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

  const handleSelectItem = (report: ReportHistoryItem) => {
    onSelectHistory(report);
    if (onClose) onClose();
  };

  const handleCreateNew = () => {
    if (onNewReport) {
      onNewReport();
    } else {
      window.location.reload();
    }
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs transition-opacity duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[var(--bg-surface)] border-r border-[var(--border-color)] flex flex-col h-full shadow-2xl md:shadow-none md:static md:translate-x-0 transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent)] flex items-center justify-center text-white shrink-0 shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-tight text-[var(--text-primary)] truncate">8D Creator</h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowBrandSettings(true)}
              className="w-9 h-9 flex items-center justify-center hover:bg-[var(--bg-base)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
              title="品牌設定"
              aria-label="品牌設定"
            >
              <Palette className="w-4 h-4" />
            </button>
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center hover:bg-[var(--bg-base)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
              title="切換主題"
              aria-label="切換主題"
            >
              {mounted ? (
                theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />
              ) : <div className="w-4 h-4" />}
            </button>
            {/* Mobile Close Button */}
            {onClose && (
              <button
                onClick={onClose}
                className="w-9 h-9 flex md:hidden items-center justify-center hover:bg-[var(--bg-base)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors ml-1"
                aria-label="關閉選單"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5 mt-4">
          
          {/* New Report Button */}
          <button
            onClick={handleCreateNew}
            className="w-full flex items-center justify-center gap-2 min-h-[44px] py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all shadow-sm"
          >
            <FileText className="w-4 h-4" />
            新增報告
          </button>

          {/* Help */}
          <button type="button" onClick={onOpenMap}
            className="flex w-full items-center justify-between rounded-lg border border-[var(--border-color)] bg-[var(--bg-base)] p-3 text-sm font-medium hover:border-[var(--accent)]">
              <span className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[var(--accent)] shrink-0" />
                使用說明
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          </button>

          {/* AI Engine Status */}
          <div className="space-y-2">
            <h2 className="text-[13px] font-medium text-[var(--text-secondary)] uppercase tracking-wide">
              {projectAgent === null ? "AI 設定" : "AI 連線"}
            </h2>

            <div className="flex items-center justify-between gap-2 p-3 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-lg">
              <div className="flex items-center gap-2.5 min-w-0">
                <Cpu className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate">
                    {projectAgent === undefined ? "正在偵測專案 Agent" : projectAgent ?? (provider === "gemini" ? "Google Gemini" : "Agnes AI")}
                  </p>
                  <p className="text-[13px] text-[var(--text-secondary)] truncate" title={model}>
                    {projectAgent ? "使用專案 Agent" : projectAgent === null ? model || "未設定" : ""}
                  </p>
                </div>
              </div>
              {projectAgent === null && <button
                onClick={() => setShowAISettings(true)}
                className="shrink-0 min-h-[36px] px-3.5 py-1.5 rounded-md text-[13px] font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:scale-[0.97] transition-all"
              >
                設定
              </button>}
            </div>
          </div>

          {/* History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[var(--text-secondary)]" />
                <h2 className="text-[13px] font-medium text-[var(--text-secondary)] uppercase tracking-wide">歷史報告</h2>
              </div>
              <span className="text-[13px] text-[var(--text-primary)] bg-[var(--bg-base)] border border-[var(--border-color)] px-2.5 py-0.5 rounded-full font-medium">
                {history.length}
              </span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder="搜尋歷史報告"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-9 text-[14px]"
              />
            </div>

            {/* Customer Filter */}
            <select
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              className="input text-[14px] appearance-none"
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
                  <p>{history.length === 0 ? "目前沒有歷史報告" : "找不到符合條件的報告"}</p>
                </div>
              ) : (
                filteredHistory.map((report) => (
                  <div
                    key={report.id}
                    onClick={() => handleSelectItem(report)}
                    className="group p-3 hover:bg-[var(--bg-base)] rounded-lg border border-transparent hover:border-[var(--border-color)] cursor-pointer transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium truncate text-[var(--text-primary)]">{report.productInfo || "未命名報告"}</p>
                        <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">{report.date}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteHistory(report.id);
                        }}
                        className="p-1.5 opacity-80 md:opacity-0 group-hover:opacity-100 text-[var(--text-secondary)] hover:text-red-500 rounded transition-all min-w-[32px] min-h-[32px] flex items-center justify-center"
                        title="刪除報告"
                        aria-label="刪除報告"
                      >
                        <Trash2 className="w-4 h-4" />
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
      {projectAgent === null && showAISettings && (
        <AISettingsModal
          onClose={() => setShowAISettings(false)}
          onSaved={refreshConfig}
        />
      )}
    </>
  );
}
