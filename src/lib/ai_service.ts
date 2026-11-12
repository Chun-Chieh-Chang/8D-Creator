/**
 * 8D-Creator Universal Multi-Provider AI Service
 * Supports:
 * 1. Agnes AI (Endpoint: https://apihub.agnes-ai.com/v1, Model: agnes-3.0-flash, Bearer Auth)
 * 2. Google AI Studio (Endpoint: https://generativelanguage.googleapis.com, Gemini API free tier)
 * 3. Custom OpenAI-compatible / Proxy Gateways
 *
 * 相容既有 localStorage keys（ai-provider / agnes-api-key / gemini-api-key），
 * 新增 8D_AI_MODEL / 8D_AI_CUSTOM_MODEL / 8D_AI_BASE_URL / 8D_AI_API_KEY。
 */

export type AIProvider = "agnes" | "gemini" | "openai_compatible";

export interface AIConfig {
  /** 既有 provider 切換（Sidebar 快速切換 / 舊版相容） */
  provider: "agnes" | "gemini";
  apiKey: string;
  model: string;
  customModel?: string;
  baseUrl?: string;
}

export const AGNES_BASE_URL = "https://apihub.agnes-ai.com/v1";
export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";

export const OFFICIAL_MODELS = {
  agnes: [
    { id: "agnes-3.0-flash", name: "agnes-3.0-flash" }
  ],
  geminiFree: [
    { id: "gemini-3.8-flash", name: "gemini-3.8-flash（預設）" },
    { id: "gemini-3.5-flash-lite", name: "gemini-3.5-flash-lite" },
    { id: "gemini-3.1-flash-lite", name: "gemini-3.1-flash-lite" }
  ]
} as const;

// 預設模型直接取自可選清單首位（清單增刪時自動跟隨，無需另行維護）
export const DEFAULT_MODEL: string = OFFICIAL_MODELS.agnes[0].id;
export const DEFAULT_GEMINI_MODEL: string = OFFICIAL_MODELS.geminiFree[0].id;
const retiredModels: Record<string, string> = {
  "agnes-2.5-flash": DEFAULT_MODEL,
  "gemini-3.7-flash": DEFAULT_GEMINI_MODEL,
  "gemini-3.1-pro": DEFAULT_GEMINI_MODEL,
  "gemini-3-flash-preview": DEFAULT_GEMINI_MODEL,
  "gemini-2.5-pro": DEFAULT_GEMINI_MODEL,
  "gemini-2.5-flash": "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite": "gemini-3.1-flash-lite",
  "gemini-1.5-flash": DEFAULT_GEMINI_MODEL,
  "gemini-1.5-pro": DEFAULT_GEMINI_MODEL,
};

export class EightDAIService {
  private providerKey = "ai-provider";
  private agnesKey = "agnes-api-key";
  private geminiKey = "gemini-api-key";
  private customApiKeyKey = "8D_AI_API_KEY";
  private modelKey = "8D_AI_MODEL";
  private customModelKey = "8D_AI_CUSTOM_MODEL";
  private baseUrlKey = "8D_AI_BASE_URL";

  getConfig(): AIConfig {
    const provider: "agnes" | "gemini" =
      localStorage.getItem(this.providerKey) === "gemini" ? "gemini" : "agnes";

    // 既有使用者未儲存模型時，依 provider 給預設（避免 gemini 使用者被導向 agnes）
    const storedModel = localStorage.getItem(this.modelKey);
    const model = storedModel && Object.hasOwn(retiredModels, storedModel) ? retiredModels[storedModel]
      : storedModel || (provider === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_MODEL);
    const config = {
      model,
      customModel: localStorage.getItem(this.customModelKey) || "",
      baseUrl: localStorage.getItem(this.baseUrlKey) || ""
    };
    const effectiveProvider = this.getEffectiveProvider(config);
    return { ...config, provider: effectiveProvider === "gemini" ? "gemini" : "agnes", apiKey: this.getStoredApiKey(effectiveProvider) };
  }

  getStoredApiKey(provider: AIProvider): string {
    const key = provider === "gemini" ? this.geminiKey : provider === "agnes" ? this.agnesKey : this.customApiKeyKey;
    return localStorage.getItem(key) || "";
  }

  /**
   * 儲存設定（模型 / API Key / Base URL）。
   * - API Key 依 provider 分槽儲存（agnes-api-key / gemini-api-key / 8D_AI_API_KEY）
   * - 自動同步 ai-provider 與預設 Base URL
   */
  saveConfig(config: {
    apiKey?: string;
    model?: string;
    customModel?: string;
    baseUrl?: string;
  }): void {
    const current = this.getConfig();
    const model = (config.model ?? current.model).trim();
    const customModel = (config.customModel ?? current.customModel ?? "").trim();
    const baseUrl = (config.baseUrl ?? current.baseUrl ?? "").trim().replace(/\/+$/, "");

    const effectiveModel = model === "custom"
      ? customModel || current.customModel || DEFAULT_MODEL
      : model || current.model;

    if (config.apiKey !== undefined) {
      this.setApiKey(this.getEffectiveProvider({ model: effectiveModel, baseUrl }), config.apiKey.trim());
    }

    if (config.model !== undefined) {
      localStorage.setItem(this.modelKey, model);
      localStorage.setItem(this.providerKey, effectiveModel.startsWith("gemini-") ? "gemini" : "agnes");
    }

    if (config.customModel !== undefined) {
      if (customModel) localStorage.setItem(this.customModelKey, customModel);
      else localStorage.removeItem(this.customModelKey);
    }

    if (config.baseUrl !== undefined) {
      if (baseUrl) localStorage.setItem(this.baseUrlKey, baseUrl);
      else localStorage.removeItem(this.baseUrlKey);
    }
  }

  clearConfig(): void {
    localStorage.removeItem(this.customApiKeyKey);
    localStorage.removeItem(this.customModelKey);
    localStorage.removeItem(this.baseUrlKey);
  }

  getEffectiveModel(config: Pick<AIConfig, "model" | "customModel">): string {
    if (config.model === "custom") {
      return config.customModel?.trim() || DEFAULT_MODEL;
    }
    return config.model || DEFAULT_MODEL;
  }

  getEffectiveProvider(config: Pick<AIConfig, "model" | "customModel" | "baseUrl">): AIProvider {
    const model = this.getEffectiveModel(config);
    const base = (config.baseUrl || "").toLowerCase();

    if (model.startsWith("agnes-")) return "agnes";
    if (model.startsWith("gemini-")) return "gemini";
    if (base === AGNES_BASE_URL) return "agnes";
    if (base === GEMINI_BASE_URL) return "gemini";
    return "openai_compatible";
  }

  getEffectiveBaseUrl(config: AIConfig): string {
    const provider = this.getEffectiveProvider(config);
    const defaultBase = provider === "gemini" ? GEMINI_BASE_URL : AGNES_BASE_URL;
    const base = config.baseUrl?.trim().replace(/\/+$/, "");
    return !base || base === AGNES_BASE_URL || base === GEMINI_BASE_URL ? defaultBase : base;
  }

  /**
   * 連線測試 (相容 Google AI Studio & Agnes AI / OpenAI-compatible)
   */
  async testConnection(conf: AIConfig = this.getConfig()): Promise<boolean> {
    if (!conf.apiKey) throw new Error("輸入 API 金鑰或 Bearer Token。");

    const provider = this.getEffectiveProvider(conf);
    const model = this.getEffectiveModel(conf);
    const base = this.getEffectiveBaseUrl(conf);

    if (provider === "gemini") {
      const endpoint = `${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": conf.apiKey
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: 'Reply "OK"' }] }],
          generationConfig: { maxOutputTokens: 64 }
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: { message?: string } }));
        throw new Error(`Google AI Studio 連線失敗 [${model}]: ${err.error?.message || res.status}`);
      }
      return true;
    }

    // Agnes AI / OpenAI-compatible（Bearer Auth）
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${conf.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: 'Reply "OK"' }],
        max_tokens: 10,
        temperature: 0.1
      })
    });

    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({} as { error?: { message?: string }; message?: string }));
      throw new Error(`連線失敗 [${model}]: ${err.error?.message || err.message || res.status}`);
    }
    return true;
  }

  private setApiKey(provider: AIProvider, apiKey: string): void {
    if (provider === "gemini") {
      if (apiKey) localStorage.setItem(this.geminiKey, apiKey);
      else localStorage.removeItem(this.geminiKey);
    } else if (provider === "agnes") {
      if (apiKey) localStorage.setItem(this.agnesKey, apiKey);
      else localStorage.removeItem(this.agnesKey);
    } else {
      if (apiKey) localStorage.setItem(this.customApiKeyKey, apiKey);
      else localStorage.removeItem(this.customApiKeyKey);
    }
  }
}

export const aiService = new EightDAIService();
