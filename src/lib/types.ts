// src/lib/types.ts

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export type StreamCallback = (chunk: string) => void;

export interface AIProvider {
  generateStream(prompt: string, callback: StreamCallback): Promise<void>;
  generate5Why(context: string, history: ChatMessage[], callback: StreamCallback): Promise<void>;
}
