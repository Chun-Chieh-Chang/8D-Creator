// src/lib/geminiClient.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { StreamCallback } from "./types";

// Exponential backoff retry helper
async function withRetry<T>(
  fn: () => Promise<T>,
  canRetry: () => boolean,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1 || !canRetry()) throw error;
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
  onChunk: StreamCallback,
  baseUrl?: string,
): Promise<void> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model }, { baseUrl });

    let emitted = false;
    await withRetry(async (): Promise<void> => {
      const result = await geminiModel.generateContentStream(prompt);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          emitted = true;
          onChunk(chunkText);
        }
      }
    }, (): boolean => !emitted);
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
}
