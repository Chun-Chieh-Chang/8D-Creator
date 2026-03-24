// src/lib/historyManager.ts
export interface ReportHistoryItem {
  id: string;
  timestamp: number;
  date: string;
  productInfo: string;
  customerName: string;
  defectQuantity: number;
  problemDescription: string;
  generatedContent: string;
}

const STORAGE_KEY = "8d_reporter_history";

export function saveHistory(item: Omit<ReportHistoryItem, "id" | "timestamp">): ReportHistoryItem {
  if (typeof window === "undefined") return item as ReportHistoryItem;
  const history = getHistory();
  const newItem: ReportHistoryItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: Date.now()
  };
  
  const updatedHistory = [newItem, ...history].slice(0, 50); // Keep last 50
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
  return newItem;
}

export function getHistory(): ReportHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function deleteHistory(id: string): void {
  if (typeof window === "undefined") return;
  const history = getHistory();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.filter(i => i.id !== id)));
}
const DRAFT_KEY = "8d_reporter_draft";

export function saveDraft(data: Partial<ReportHistoryItem>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
}

export function getDraft(): Partial<ReportHistoryItem> | null {
  if (typeof window === "undefined") return null;
  try {
    const data = localStorage.getItem(DRAFT_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DRAFT_KEY);
}
