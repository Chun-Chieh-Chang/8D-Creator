// src/lib/geminiClient.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatMessage, StreamCallback } from "./types";
import { buildEnhanced5WhyPrompt } from './tools/promptBuilder';

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
  const enhancedPrompt = buildEnhanced5WhyPrompt(context, history);
  return generateGeminiReport(apiKey, enhancedPrompt, onChunk);
}
