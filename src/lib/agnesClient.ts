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

async function streamChatCompletions(
  apiKey: string,
  model: string,
  baseUrl: string,
  messages: { role: string; content: string }[],
  onChunk: StreamCallback
) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
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
  let pending = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = done ? "" : lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        if (!data) continue;
        const json: { choices?: { delta?: { content?: string } }[] } = JSON.parse(data);
        const content = json.choices?.[0]?.delta?.content;
        if (content) onChunk(content);
      }
      if (done) return;
    }
  } finally {
    await reader.cancel().catch((): void => {});
    reader.releaseLock();
  }
}

export async function generateAgnesReport(
  apiKey: string,
  model: string,
  baseUrl: string,
  prompt: string,
  onChunk: StreamCallback,
  systemMessage?: string
): Promise<void> {
  try {
    const messages: { role: string; content: string }[] = [];
    
    if (systemMessage) {
      messages.push({ role: "system", content: systemMessage });
    }
    
    messages.push({ role: "user", content: prompt });
    
    let emitted = false;
    await withRetry(() => streamChatCompletions(apiKey, model, baseUrl, messages, (chunk: string): void => {
      emitted = true;
      onChunk(chunk);
    }), (): boolean => !emitted);
  } catch (error) {
    console.error("Agnes Report Error:", error);
    throw error;
  }
}
