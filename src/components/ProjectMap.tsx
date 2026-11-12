import type { ReactNode } from "react";
import {
  ArrowDown, ArrowDownRight, ArrowRight, BookOpen, ClipboardCheck, FileText, FolderSearch, Plus, type LucideIcon,
} from "lucide-react";
import ProjectFlow from "./ProjectFlow";

export type CaseDestination = "search" | "new" | "nca" | "case-report" | "knowledge";
export type MapDestination = CaseDestination | "report";

interface Props {
  localWorkspace: boolean;
  onNavigate: (destination: MapDestination) => void;
  onResume?: () => void;
}

function MapAction({ icon: Icon, title, description, onClick }: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}): ReactNode {
  return (
    <button type="button" onClick={onClick}
      className="group flex min-h-20 w-full items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 text-left transition-colors hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--bg-base)] text-[var(--accent)]">
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-sm leading-snug text-[var(--text-secondary)]">{description}</span>
      </span>
      <ArrowRight size={16} className="shrink-0 text-[var(--text-secondary)] group-hover:text-[var(--accent)]" aria-hidden="true" />
    </button>
  );
}

function FlowArrow({ children }: { children?: ReactNode }): ReactNode {
  return <div className="flex items-center justify-center gap-2 py-2 text-xs text-[var(--text-secondary)]">
    <ArrowDown size={16} aria-hidden="true" />{children}
  </div>;
}

export default function ProjectMap({ localWorkspace, onNavigate, onResume }: Props): ReactNode {
  return (
    <section className="min-h-0 flex-1 overflow-y-auto bg-[var(--bg-base)]" aria-labelledby="project-map-title">
      <div className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 id="project-map-title" className="text-xl font-semibold sm:text-2xl">專案地圖</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              追蹤案件資料如何進入 8D 報告、匯出檔案或存入 Obsidian。
            </p>
            {!localWorkspace && <p className="mt-1 text-sm text-[var(--text-secondary)]">
              案件操作會開啟本機工作區。請先執行 <code>npm run local</code> 啟動本機服務。
            </p>}
          </div>
          {onResume && <button type="button" className="btn btn-secondary text-sm" onClick={onResume}>繼續目前任務</button>}
        </header>

        <ProjectFlow localWorkspace={localWorkspace} onNavigate={onNavigate} />

        <section aria-labelledby="map-shortcuts" className="mx-auto mt-6 max-w-4xl">
          <h2 id="map-shortcuts" className="mb-3 text-base font-semibold">快速入口</h2>
          <section aria-labelledby="map-entry" className="card p-4">
            <h3 id="map-entry" className="mb-3 text-sm font-semibold">登錄或查找案件</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <MapAction icon={Plus} title="新增案件" description="登錄廠內、供應商或客戶異常。" onClick={(): void => onNavigate("new")} />
              <MapAction icon={FolderSearch} title="搜尋案件" description="依品號、缺陷、案件 ID 或 NCA 單號查找。" onClick={(): void => onNavigate("search")} />
            </div>
          </section>

          <FlowArrow>開啟案件後，依需要選擇</FlowArrow>

          <section aria-label="案件處理" className="grid gap-2 sm:grid-cols-2">
            <MapAction icon={ClipboardCheck} title="複核與列管 NCA" description="查閱附件。記錄參考案件、NCA 狀態、期限或 CAPA。" onClick={(): void => onNavigate("nca")} />
            <MapAction icon={FileText} title="從案件製作 8D 報告" description="手寫草稿或執行 5-Why。將報告存回原案件。" onClick={(): void => onNavigate("case-report")} />
          </section>

          <FlowArrow>將可沿用的經驗留給下一案</FlowArrow>

          <MapAction icon={BookOpen} title="查閱經驗筆記" description="查閱已整理的經驗。可補充筆記或更新缺陷詞彙。" onClick={(): void => onNavigate("knowledge")} />

          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <ArrowDownRight size={16} className="text-[var(--text-secondary)]" aria-hidden="true" />
            <button type="button" className="btn btn-ghost" onClick={(): void => onNavigate("report")}>
              直接開啟 8D 報告
            </button>
            <span className="text-[var(--text-secondary)]">可直接填寫或開啟歷史報告。</span>
          </div>
        </section>
      </div>
    </section>
  );
}
