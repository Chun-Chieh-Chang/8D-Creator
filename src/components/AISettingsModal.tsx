"use client";

import { useState, useEffect } from "react";
import {
  Cpu,
  KeyRound,
  Link2,
  Zap,
  CheckCircle2,
  X
} from "lucide-react";
import {
  aiService,
  OFFICIAL_MODELS,
  DEFAULT_MODEL,
  AGNES_BASE_URL,
  GEMINI_BASE_URL
} from "@/lib/ai_service";

interface AISettingsModalProps {
  onClose: () => void;
  /** 儲存成功後通知父層刷新（Sidebar 的 provider / apiKey 狀態） */
  onSaved?: () => void;
}

interface TestResult {
  success: boolean;
  msg: string;
}

export default function AISettingsModal({ onClose, onSaved }: AISettingsModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [customModel, setCustomModel] = useState("");
  const [baseUrl, setBaseUrl] = useState(AGNES_BASE_URL);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    const conf = aiService.getConfig();
    setApiKey(conf.apiKey);
    setBaseUrl(aiService.getEffectiveBaseUrl(conf));

    // 若已儲存的模型不在官方清單內，視為自訂模型
    const knownIds: string[] = Object.values(OFFICIAL_MODELS).flat().map(m => m.id);
    if (knownIds.includes(conf.model)) {
      setModel(conf.model);
    } else {
      setModel("custom");
      setCustomModel(conf.model === "custom" ? conf.customModel ?? "" : conf.model);
    }
  }, []);

  const handleModelChange = (selectedModel: string): void => {
    const currentProvider = aiService.getEffectiveProvider({ model, customModel, baseUrl });
    const nextBase = selectedModel.startsWith("gemini-") ? GEMINI_BASE_URL : selectedModel === "custom" ? "" : AGNES_BASE_URL;
    const nextProvider = aiService.getEffectiveProvider({ model: selectedModel, customModel, baseUrl: nextBase });
    setModel(selectedModel);
    setBaseUrl(nextBase);
    if (currentProvider !== nextProvider) setApiKey(aiService.getStoredApiKey(nextProvider));
  };

  const handleSave = () => {
    aiService.saveConfig({ apiKey, model, customModel, baseUrl });
    onSaved?.();
    onClose();
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await aiService.testConnection({ provider: model.startsWith("gemini-") ? "gemini" : "agnes", apiKey: apiKey.trim(), model, customModel, baseUrl: baseUrl.trim().replace(/\/+$/, "") });
      setTestResult({ success: true, msg: "連線成功。" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setTestResult({ success: false, msg: `連線失敗。 ${message}` });
    } finally {
      setTesting(false);
    }
  };

  const selectedProvider = model.startsWith("gemini-")
    ? "gemini"
    : model === "custom"
      ? (customModel.startsWith("gemini-") ? "gemini" : "agnes")
      : "agnes";

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${mounted ? 'animate-in fade-in duration-200' : 'opacity-0'}`}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--accent)]/15 rounded-lg">
              <Cpu className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">AI 設定</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-base)] rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 py-4 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Model Selection */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <Cpu className="w-4 h-4 text-[var(--accent)]" />
              AI 模型
            </label>
            <select
              value={model}
              onChange={(e) => handleModelChange(e.target.value)}
              className="w-full h-11 px-3.5 bg-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none"
            >
              <optgroup label="Agnes AI 模型">
                {OFFICIAL_MODELS.agnes.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                    {m.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Google AI Studio 免費層">
                {OFFICIAL_MODELS.geminiFree.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                    {m.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="自訂模型">
                <option value="custom" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                  自訂模型
                </option>
              </optgroup>
            </select>
          </div>

          {/* Custom Model ID */}
          {model === "custom" && (
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <Cpu className="w-4 h-4 text-[var(--accent)]" />
                自訂模型 ID
              </label>
              <input
                type="text"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="例如: agnes-3.0-flash, custom-llm"
                className="w-full h-11 px-3.5 bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-80 border border-[var(--border-color)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none transition-all"
              />
            </div>
          )}

          {/* API Key */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <KeyRound className="w-4 h-4 text-[var(--accent)]" />
              API 金鑰或 Bearer Token
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="輸入 AGNES_API_KEY 或 GEMINI_API_KEY..."
              className="w-full h-11 px-3.5 bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-80 border border-[var(--border-color)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none transition-all"
            />
            <p className="text-xs sm:text-[13px] text-[var(--text-secondary)]">
              {selectedProvider === "gemini" ? (
                <span>前往 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[var(--accent)] font-medium underline">Google AI Studio</a> 取得 API 金鑰</span>
              ) : (
                <span>前往 <a href="https://apihub.agnes-ai.com" target="_blank" rel="noreferrer" className="text-[var(--accent)] font-medium underline">Agnes AI Hub</a> 取得 API 金鑰</span>
              )}
            </p>
          </div>

          {/* Base URL */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <Link2 className="w-4 h-4 text-[var(--accent)]" />
              API 基礎網址
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://apihub.agnes-ai.com/v1"
              className="w-full h-11 px-3.5 bg-[var(--bg-base)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-80 border border-[var(--border-color)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none transition-all"
            />
            <p className="text-xs sm:text-[13px] text-[var(--text-secondary)]">
              輸入服務的 API 基礎網址。
            </p>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`p-3 rounded-lg text-sm border ${
              testResult.success
                ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30"
                : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
            }`}>
              {testResult.msg}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-base)]">
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-lg transition-colors disabled:opacity-50 min-h-[40px]"
          >
            <Zap className="w-4 h-4" />
            {testing ? "正在測試連線" : "測試連線"}
          </button>

          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-3.5 sm:px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] rounded-lg transition-colors min-h-[40px]"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 sm:px-5 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold rounded-lg transition-colors shadow-md shadow-[var(--accent)]/20 min-h-[40px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              儲存設定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}