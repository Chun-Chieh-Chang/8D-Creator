// src/lib/geminiClient.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatMessage, StreamCallback } from "./types";

export async function generateGeminiReport(
  apiKey: string,
  prompt: string,
  onChunk: StreamCallback
) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      onChunk(chunkText);
    }
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
}

export async function generateGemini5Why(
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

  return generateGeminiReport(apiKey, prompt, onChunk);
}
