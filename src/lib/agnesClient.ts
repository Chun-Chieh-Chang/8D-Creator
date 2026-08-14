import { ChatMessage, StreamCallback } from "./types";

const AGNES_BASE_URL = "https://apihub.agnes-ai.com/v1";
const AGNES_MODEL = "agnes-2.5-flash";

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
  onChunk: StreamCallback,
  systemMessage?: string
) {
  try {
    const messages: { role: string; content: string }[] = [];
    
    if (systemMessage) {
      messages.push({ role: "system", content: systemMessage });
    }
    
    messages.push({ role: "user", content: prompt });
    
    await withRetry(() => streamChatCompletions(apiKey, messages, onChunk));
  } catch (error) {
    console.error("Agnes Report Error:", error);
    throw error;
  }
}

import { buildEnhanced5WhyPrompt } from './tools/promptBuilder';

export async function generateAgnes5Why(
  apiKey: string,
  context: string,
  history: ChatMessage[],
  onChunk: StreamCallback
) {
  const enhancedPrompt = buildEnhanced5WhyPrompt(context, history);
  return generateAgnesReport(apiKey, enhancedPrompt, onChunk);
}
