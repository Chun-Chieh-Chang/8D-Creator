import { ChatMessage, StreamCallback } from "./types";

export async function generate8DReport(prompt: string, onChunk: StreamCallback) {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5:7b",
        prompt: prompt,
        stream: true,
      }),
    });

    if (!response.body) throw new Error("No response body");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.response) onChunk(json.response);
        } catch {
          // Ignore parse errors for partial chunks
        }
      }
    }
  } catch (error) {
    console.error("Ollama Error:", error);
    throw error;
  }
}

export async function generate5WhyQuestion(
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

  return generate8DReport(prompt, onChunk);
}
