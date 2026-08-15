// src/lib/geminiClient.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatMessage, StreamCallback } from "./types";
import { buildEnhanced5WhyPrompt } from './tools/promptBuilder';

// Exponential backoff retry helper
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const waitTime = delayMs * Math.pow(2, i);
      console.warn(`Retry ${i + 1}/${maxRetries} after ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  throw new Error("Retry failed");
}

export async function generateGeminiReport(
  apiKey: string,
  model: string,
  prompt: string,
  onChunk: StreamCallback
) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model });

    await withRetry(async () => {
      const result = await geminiModel.generateContentStream(prompt);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        onChunk(chunkText);
      }
    });
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
}

export async function generateGemini5Why(
  apiKey: string,
  model: string,
  context: string,
  history: ChatMessage[],
  onChunk: StreamCallback
) {
  const enhancedPrompt = buildEnhanced5WhyPrompt(context, history);
  return generateGeminiReport(apiKey, model, enhancedPrompt, onChunk);
}
