import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { MapDestination } from "./ProjectMap";

export interface CasePosition {
  creating: boolean;
  item?: { id: string; title: string };
}

export interface ReportPosition {
  step: "input" | "analysis" | "final";
  saved: boolean;
  ready: boolean;
}

interface Props {
  view: "cases" | "report";
  task?: MapDestination;
  casePosition: CasePosition;
  reportPosition: ReportPosition;
  linkedCase?: string;
  onMap: () => void;
  onReturnToCase?: () => void;
}

interface Path {
  steps: string[];
  next: string;
  current?: number;
}

function casePath(task: MapDestination | undefined, position: CasePosition): Path {
  if (position.creating) return { steps: ["新增案件", "案件明細"], current: 0, next: "填寫來源、日期和名稱，再選取「建立案件」。" };
  if (task === "knowledge" && !position.item) {
    return { steps: ["經驗筆記與資料維護"], next: "選擇筆記，或新增可沿用的經驗。" };
  }
  const entry = task === "new" ? "新增案件" : task === "nca" || task === "case-report" ? "選擇案件" : "搜尋案件";
  if (!position.item) return {
    steps: [entry, task === "nca" ? "複核與列管 NCA" : task === "case-report" ? "8D 報告" : "案件明細"],
    current: 0,
    next: task === "new" ? "選取「新增案件」，開始登錄。"
      : "用品號、缺陷或 NCA 單號搜尋，再選取案件。",
  };
  if (task === "nca") return {
    steps: [entry, "複核與列管 NCA"],
    next: "確認案件是否僅供參考，或填寫 NCA 狀態及處置資料。",
  };
  if (task === "case-report") return {
    steps: [entry, "案件明細", "8D 報告"],
    current: 1,
    next: "選取「製作 8D 報告」，或從「8D 草稿」開啟已儲存版本。",
  };
  return { steps: [entry, "案件明細"], next: "查看證據附件，再依需要複核、處理 NCA 或製作 8D。" };
}

function reportPath(linked: boolean, position: ReportPosition): Path {
  const prefix = linked ? ["案件明細"] : [];
  if (position.step === "input") return {
    steps: [...prefix, "8D 報告", "填寫資料"],
    next: linked ? "填寫資料，再選擇「開始分析」或「手寫 8D 草稿」。" : "填寫問題標題和缺陷描述，再選取「開始分析」。",
  };
  if (position.step === "analysis") return {
    steps: [...prefix, "8D 報告", "原因分析"],
    next: "回答 5-Why 問題。也可選取「跳過分析並產生報告」。",
  };
  if (!position.ready) return {
    steps: [...prefix, "8D 報告", "產生報告"],
    next: "報告產生後即可查閱。若畫面顯示錯誤，依提示處理。",
  };
  if (linked && position.saved) return {
    steps: [...prefix, "8D 報告", "已儲存至案件"],
    next: "可回原案件查看草稿版本，或匯出報告。",
  };
  return {
    steps: [...prefix, "8D 報告", linked ? "儲存或匯出報告" : "匯出報告"],
    next: linked ? "選取「儲存至案件」保留版本，或選擇匯出格式。" : "選擇 Word、HTML 或 PDF。",
  };
}

export default function TaskTrail({ view, task, casePosition, reportPosition, linkedCase, onMap, onReturnToCase }: Props): ReactNode {
  const path = view === "report" ? reportPath(Boolean(linkedCase), reportPosition) : casePath(task, casePosition);
  const current = path.current ?? path.steps.length - 1;
  const context = view === "report" ? linkedCase : casePosition.item?.title;
  return (
    <section aria-label="任務路徑" className="shrink-0 space-y-1 border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 sm:px-4">
      <nav aria-label="目前路徑">
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm">
          <li><button type="button" className="min-h-8 px-1 text-[var(--accent)] underline underline-offset-2" onClick={onMap}>返回地圖</button></li>
          {path.steps.map((step: string, index: number): ReactNode => (
            <li key={step} className="flex min-w-0 items-center gap-1">
              <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-[var(--text-secondary)]" />
              {index === 0 && step === "案件明細" && view === "report" && onReturnToCase
                ? <button type="button" className="min-h-8 px-1 text-[var(--accent)] underline underline-offset-2" onClick={onReturnToCase}>回原案件</button>
                : <span aria-current={index === current ? "step" : undefined}
                    className={index === current ? "font-semibold" : "text-[var(--text-secondary)]"}>{step}</span>}
            </li>
          ))}
        </ol>
      </nav>
      <p className="text-xs leading-relaxed text-[var(--text-secondary)]" aria-live="polite">
        <span className="font-medium">下一步</span> {path.next}
      </p>
      {context && <p className="truncate text-xs text-[var(--text-secondary)]" title={context}>{context}</p>}
    </section>
  );
}
