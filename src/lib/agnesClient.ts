import { ChatMessage, StreamCallback } from "./types";

const AGNES_BASE_URL = "https://apihub.agnes-ai.com/v1";
const AGNES_MODEL = "agnes-2.5-flash";

interface ChatChoice {
  message: {
    role: string;
    content: string;
  };
}

interface ChatResponse {
  choices: ChatChoice[];
}

async function streamChatCompletions(
  apiKey: string,
  messages: { role: string; content: string }[],
  onChunk: StreamCallback
) {
  const response = await fetch(`${AGNES_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AGNES_MODEL,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Agnes API error ${response.status}: ${errorText}`);
  }

  if (!response.body) throw new Error("No response body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");
    for (const line of lines) {
      if (!line.trim() || line.startsWith("data: ")) continue;
      try {
        const json = JSON.parse(line.replace(/^data: /, ""));
        const content = json.choices?.[0]?.delta?.content;
        if (content) onChunk(content);
      } catch {
        // Ignore parse errors for partial chunks
      }
    }
  }
}

export async function generateAgnesReport(
  apiKey: string,
  prompt: string,
  onChunk: StreamCallback
) {
  try {
    await streamChatCompletions(apiKey, [
      { role: "user", content: prompt },
    ], onChunk);
  } catch (error) {
    console.error("Agnes Report Error:", error);
    throw error;
  }
}

export async function generateAgnes5Why(
  apiKey: string,
  context: string,
  history: ChatMessage[],
  onChunk: StreamCallback
) {
  const conversation = history.map(h => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`).join("\n");

  const prompt = `你是一名的資深質量管理專家與 8D 顧問。你的目標是引導用戶進行「5-Why」根本原因分析。
  所有對話與輸出請使用「中英文對照」格式，且中文部分「嚴禁使用簡體字」，必須使用「繁體中文」。
  
  [背景資訊]
  ${context}
  
  [對話歷史]
  ${conversation}
  
  [專家指令]
  1. 請根據背景與歷史，提出下一個「為什麼」。
  2. 語氣要專業、嚴謹。
  3. 如果你認為已經找到根本原因（Systemic Root Cause），請輸出的結尾加上 [FINISH_ANALYSIS]。
  4. 輸出必須包含中英文對照。`;

  return generateAgnesReport(apiKey, prompt, onChunk);
}
