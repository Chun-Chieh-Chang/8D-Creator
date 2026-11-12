import { generateAgnesReport } from "./agnesClient";
import { generateGeminiReport } from "./geminiClient";
import { aiService } from "./ai_service";
import { kbBase, kbRequest } from "./knowledgeWorkspace";
import type { StreamCallback } from "./types";

export async function detectProjectAgent(signal: AbortSignal): Promise<string | null> {
  if (window.location.hostname !== "127.0.0.1") return null;
  try {
    const status = await kbRequest<{ available: boolean; name?: string }>("agent", { signal });
    return status.available ? status.name ?? "專案 Agent" : null;
  } catch {
    return null;
  }
}

export async function generate8D(
  agent: string | null | undefined,
  prompt: string,
  callback: StreamCallback,
  onAgentUnavailable: () => void,
): Promise<void> {
  if (agent === undefined) throw new Error("正在偵測專案 Agent。請稍候再試。");
  if (agent) {
    let response: Response;
    try {
      response = await fetch(kbBase + "agent", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }),
      });
    } catch {
      onAgentUnavailable();
      throw new Error("無法連到專案 Agent。請檢查本機服務。");
    }
    if (!response.headers.get("content-type")?.includes("application/json")) {
      onAgentUnavailable();
      throw new Error("無法連到專案 Agent。請檢查本機服務。");
    }
    const result: { available?: boolean; text?: string; error?: string } = await response.json();
    if (result.available === false) onAgentUnavailable();
    if (!response.ok || !result.text?.trim()) throw new Error(result.error || "專案 Agent 未傳回內容。請重試。");
    callback(result.text);
    return;
  }

  const config = aiService.getConfig();
  if (!config.apiKey) throw new Error("在 AI 設定中輸入 API 金鑰。");
  const model = aiService.getEffectiveModel(config);
  const base = aiService.getEffectiveBaseUrl(config);
  if (aiService.getEffectiveProvider(config) === "gemini") {
    await generateGeminiReport(config.apiKey, model, prompt, callback, base);
  } else {
    await generateAgnesReport(config.apiKey, model, base, prompt, callback);
  }
}
