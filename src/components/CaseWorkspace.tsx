import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, FolderOpen, Plus, RefreshCw } from "lucide-react";
import NcaPanel from "@/components/NcaPanel";
import type { CaseDestination } from "@/components/ProjectMap";
import type { CasePosition } from "@/components/TaskTrail";
import {
  errorText, kbBase, kbPost, kbRequest, ncaLabels,
  type CaseCatalog, type CaseDetail, type CaseDraft, type CaseReview, type CaseSummary, type NcaControl,
} from "@/lib/knowledgeWorkspace";

const statuses: Record<string, string> = {
  pending: "待複核", reviewed: "已複核", closed: "已複核並附確效證據", duplicate: "重複案件", missing: "來源失聯", invalid: "複核有誤",
};
const emptyReview: CaseReview = {
  review_status: "pending", defect: null, evidence_path: null, evidence_locator: null,
  finding: null, verification_path: null, verification_locator: null, verification_result: null, duplicate_of: null,
};
const fieldName = (file: string): string => file.split("/").at(-1) ?? file;
const endpoint = (route: string, values: Record<string, string>): string => route + "?" + new URLSearchParams(values);
const textDate = (): string => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(new Date());

interface WorkspaceProps {
  version: number;
  onReport: (item: CaseDetail, draft?: CaseDraft) => void;
  navigation?: { destination: CaseDestination; caseId?: string };
  onPositionChange: (position: CasePosition) => void;
}

interface ExperienceNote {
  name: string;
  markdown: string;
  revision: string | null;
}

export default function CaseWorkspace({ version, onReport, navigation, onPositionChange }: WorkspaceProps): ReactNode {
  const [catalog, setCatalog] = useState<CaseCatalog | null>(null);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [ncaFilter, setNcaFilter] = useState("");
  const [defect, setDefect] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState("");
  const [reading, setReading] = useState<ExperienceNote | null>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [editingTerms, setEditingTerms] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const knowledgeSection = useRef<HTMLDetailsElement>(null);
  const ncaSection = useRef<HTMLDivElement>(null);
  const reportButton = useRef<HTMLButtonElement>(null);
  const caseTitleInput = useRef<HTMLInputElement>(null);
  const caseHeading = useRef<HTMLHeadingElement>(null);
  const focusAfterSelection = useRef<"nca" | "case-report" | null>(null);

  useEffect((): (() => void) => {
    let current = true;
    void kbRequest<CaseCatalog>("cases").then((data: CaseCatalog): void => {
      if (current) setCatalog(data);
    }).catch((error: unknown): void => { if (current) setMessage(errorText(error)); });
    return (): void => { current = false; };
  }, [version]);

  useEffect((): (() => void) => {
    let current = true;
    if (selected) void kbRequest<CaseDetail>(endpoint("case", { id: selected })).then((data: CaseDetail): void => {
      if (current) setDetail(data);
    }).catch((error: unknown): void => { if (current) setMessage(errorText(error)); });
    return (): void => { current = false; };
  }, [selected, version]);

  const load = async (id = selected): Promise<void> => {
    const next = await kbRequest<CaseCatalog>("cases");
    setCatalog(next);
    if (id) setDetail(await kbRequest<CaseDetail>(endpoint("case", { id })));
  };

  const perform = async (action: () => Promise<void>, success?: string): Promise<void> => {
    setBusy(true);
    setMessage("");
    setNotice("");
    try {
      await action();
      if (success) setNotice(success);
    } catch (error: unknown) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const choose = useCallback((id: string): void => {
    setDetail((previous: CaseDetail | null): CaseDetail | null => previous?.id === id ? previous : null);
    setPreview("");
    setReading(null);
    setCreating(false);
    setMessage("");
    setNotice("");
    setSelected(id);
  }, []);

  useEffect((): (() => void) | undefined => {
    if (!navigation) return;
    const { destination, caseId } = navigation;
    let focusFrame = 0;
    const frame = requestAnimationFrame((): void => {
      choose(caseId ?? "");
      if (caseId) {
        focusAfterSelection.current = "case-report";
        focusFrame = requestAnimationFrame((): void => {
          if (!caseHeading.current) return;
          focusAfterSelection.current = null;
          caseHeading.current.focus();
        });
        return;
      }
      setCategory("");
      setStatus("");
      setNcaFilter("");
      setDefect("");
      setQuery("");
      focusAfterSelection.current = destination === "nca" || destination === "case-report" ? destination : null;
      if (destination === "new") setCreating(true);
      focusFrame = requestAnimationFrame((): void => {
        if (destination === "new") caseTitleInput.current?.focus();
        else if (destination === "knowledge" && knowledgeSection.current) {
          knowledgeSection.current.open = true;
          knowledgeSection.current.querySelector("summary")?.focus();
        } else searchInput.current?.focus();
      });
    });
    return (): void => { cancelAnimationFrame(frame); cancelAnimationFrame(focusFrame); };
  }, [navigation, choose]);

  const create = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    void perform(async (): Promise<void> => {
      const result = await kbPost<{ id: string }>("new", fields);
      setCategory("");
      setStatus("");
      setNcaFilter("");
      setDefect("");
      setQuery("");
      choose(result.id);
      setCatalog(await kbRequest<CaseCatalog>("cases"));
    }, "已新增案件。");
  };

  const current = detail?.id === selected ? detail : null;
  const currentId = current?.id;
  const currentTitle = current?.title;
  useEffect((): void => {
    onPositionChange({ creating, item: currentId && currentTitle ? { id: currentId, title: currentTitle } : undefined });
  }, [creating, currentId, currentTitle, onPositionChange]);
  useEffect((): (() => void) | undefined => {
    if (!currentId || !focusAfterSelection.current) return;
    const frame = requestAnimationFrame((): void => {
      const target = focusAfterSelection.current === "nca" ? ncaSection.current : reportButton.current;
      focusAfterSelection.current = null;
      target?.scrollIntoView({ block: "center" });
      target?.focus({ preventScroll: true });
    });
    return (): void => cancelAnimationFrame(frame);
  }, [currentId]);
  const termMap = new Map(catalog?.terms.map((term: CaseCatalog["terms"][number]) => [term.id, term]));
  const words = query.trim().normalize("NFKC").toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = catalog?.cases.filter((item: CaseSummary): boolean => {
    if ((category && item.category !== category) || (status && item.status !== status)
      || (ncaFilter && (ncaFilter === "overdue" ? !item.ncaDeadline?.overdue : item.ncaStatus !== ncaFilter))
      || (defect && item.defect !== defect && !item.hints.includes(defect))) return false;
    const names = [...item.hints, item.defect ?? ""].flatMap((id: string): string[] => {
      const term = termMap.get(id);
      return term ? [term.label, ...term.aliases] : [];
    });
    const searchable = [item.id, item.day, item.title, item.ncaNumber, ...item.products, ...item.refs, ...names].join(" ").normalize("NFKC").toLowerCase();
    return words.every((word: string): boolean => searchable.includes(word));
  }) ?? [];
  const similar = current ? catalog?.cases.filter((item: CaseSummary): boolean =>
    item.id !== current.id && (item.refs.some((ref: string): boolean => current.refs.includes(ref))
      || item.products.some((product: string): boolean => current.products.includes(product)))) ?? [] : [];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[var(--bg-base)]">
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h1 className="text-xl font-semibold">案件工作區</h1>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-secondary text-sm" disabled={busy} onClick={(): void => void perform(async (): Promise<void> => {
              await kbPost("sync", {});
              await load();
            }, "已同步案件。")}><RefreshCw size={15} />同步案件</button>
            <button className="btn btn-primary text-sm" disabled={busy} onClick={(): void => { choose(""); setCreating(true); }}><Plus size={15} />新增案件</button>
          </div>
        </header>
        {message && <p role="alert" className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-900">{message}</p>}
        {notice && <p role="status" className="mb-3 rounded-md border border-[var(--border-color)] p-3 text-sm">{notice}</p>}
        <div className="grid gap-4 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
          <section aria-label="案件清單" className={`card p-3 space-y-3 self-start ${(selected || creating) ? "hidden lg:block" : ""}`}>
            <input ref={searchInput} className="input w-full" aria-label="搜尋案件" placeholder="搜尋品號、缺陷或案件 ID" value={query} onChange={(event): void => setQuery(event.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <select className="input min-w-0" aria-label="來源類別" value={category} onChange={(event): void => setCategory(event.target.value)}>
                <option value="">所有來源</option>
                {Object.entries(catalog?.categories ?? {}).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
              <select className="input min-w-0" aria-label="案件狀態" value={status} onChange={(event): void => setStatus(event.target.value)}>
                <option value="">所有狀態</option>
                {Object.entries(statuses).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </div>
            <select className="input w-full" aria-label="缺陷" value={defect} onChange={(event): void => setDefect(event.target.value)}>
              <option value="">所有缺陷</option>
              {catalog?.terms.map((term: CaseCatalog["terms"][number]) => <option key={term.id} value={term.id}>{term.label}</option>)}
            </select>
            <select className="input w-full" aria-label="篩選 NCA 狀態" value={ncaFilter} onChange={(event): void => setNcaFilter(event.target.value)}>
              <option value="">所有 NCA 狀態</option>
              {Object.entries(ncaLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              <option value="overdue">已逾目前期限</option>
            </select>
            <p className="text-sm text-[var(--text-secondary)]">{catalog ? `${filtered.length} 筆案件` : "正在讀取案件。"}</p>
            <div className="max-h-[52vh] overflow-y-auto">
              {filtered.map((item: CaseSummary) => (
                <button type="button" key={item.id} aria-current={selected === item.id ? "true" : undefined}
                  onClick={(): void => { if (selected !== item.id) choose(item.id); }}
                  className="block w-full rounded-md border-b border-[var(--border-color)] px-2 py-2 text-left hover:bg-[var(--bg-base)] aria-current:bg-[var(--bg-base)]">
                  <span className="block break-words text-sm font-medium">{item.title}</span>
                  <span className="text-xs text-[var(--text-secondary)]">{item.day} · {catalog?.categories[item.category]} · {statuses[item.status]}</span>
                  <span className="block text-xs text-[var(--text-secondary)]">
                    NCA {item.ncaNumber || ncaLabels[item.ncaStatus]}
                    {item.ncaStatus === "issued" && item.ncaProgress === "closed" && " · 已結案"}
                    {item.ncaStatus === "issued" && item.ncaProgress === "transferred" && " · 轉開新單"}
                    {item.ncaDeadline?.overdue && (item.ncaDeadline.basis === "estimated" ? " · 暫算已逾期" : " · 已逾期")}
                  </span>
                </button>
              ))}
            </div>
            <details ref={knowledgeSection} className="border-t border-[var(--border-color)] pt-2 text-sm">
              <summary className="cursor-pointer">經驗筆記與資料維護</summary>
              <div className="mt-2 max-h-60 space-y-2 overflow-y-auto">
                {catalog?.notes.map((name: string) => <button key={name} type="button" className="block text-left underline"
                  onClick={(): void => void perform(async (): Promise<void> => {
                    const note = await kbRequest<Omit<ExperienceNote, "name">>(endpoint("note", { name }));
                    setReading({ name, ...note });
                    setEditingNote(false);
                  })}>{name.replace(/\.md$/, "")}</button>)}
                <button type="button" className="block underline" onClick={(): void => {
                  setReading({ name: "", markdown: "", revision: null });
                  setEditingNote(true);
                }}>新增經驗筆記</button>
                <button type="button" className="block underline" onClick={(): void => setEditingTerms(true)}>編輯缺陷詞彙</button>
                {Boolean(catalog?.gaps.length) && <h3 className="pt-2 font-medium">未歸檔來源</h3>}
                {catalog?.gaps.map((file: string) => <button key={file} type="button" className="block break-all text-left underline" onClick={(): void => setPreview(file)}>{file}</button>)}
                {catalog?.issues.map((issue: string) => <p key={issue} className="break-all">{issue}</p>)}
                <a className="block underline" href={kbBase + "sql"} download>匯出已複核案件 SQL</a>
              </div>
            </details>
          </section>

          {creating ? <section className="card p-4 sm:p-6">
            <button className="btn btn-ghost mb-3" onClick={(): void => setCreating(false)}><ArrowLeft size={16} />返回清單</button>
            <form onSubmit={create} className="max-w-lg space-y-4">
              <h2 className="text-lg font-semibold">新增案件</h2>
              <label className="label block">來源類別
                <select name="category" className="input mt-1 w-full" required>
                  <option value="internal">廠內</option><option value="supplier">供應商</option><option value="customer">客戶</option>
                </select>
              </label>
              <label className="label block">發生日期<input type="date" name="day" className="input mt-1 w-full" defaultValue={textDate()} required /></label>
              <label className="label block">案件名稱<input ref={caseTitleInput} name="title" className="input mt-1 w-full" maxLength={120} placeholder="例：R1-15198 外觀色差" required /></label>
              <button className="btn btn-primary" disabled={busy}>建立案件</button>
            </form>
          </section> : current ? <section className="card min-w-0 p-4 sm:p-6 space-y-5">
            <button className="btn btn-ghost lg:hidden" onClick={(): void => choose("")}><ArrowLeft size={16} />返回清單</button>
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 ref={caseHeading} tabIndex={-1} className="break-words text-lg font-semibold">{current.title}</h2>
                <p className="text-sm text-[var(--text-secondary)]">{current.day} · {catalog?.categories[current.category]} · {statuses[current.status]}</p>
                <p className="text-xs text-[var(--text-secondary)]">{current.id}</p>
              </div>
              <button ref={reportButton} className="btn btn-primary text-sm" disabled={current.status === "missing"} onClick={(): void => onReport(current)}>製作 8D 報告</button>
            </header>
            {current.errors.length > 0 && <ul className="text-sm text-red-700">{current.errors.map((problem: string) => <li key={problem}>{problem}</li>)}</ul>}
            <details open className="border-t border-[var(--border-color)] pt-3">
              <summary className="cursor-pointer font-medium">證據附件（{current.evidence.length}）</summary>
              {current.locator && <p className="mt-2 text-sm">{current.locator}</p>}
              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                {current.evidence.map((file: string) => <button key={file} title={file} type="button" className="block max-w-full break-all py-1 text-left text-sm underline"
                  onClick={(): void => setPreview(file)}>{fieldName(file)}</button>)}
                {!current.evidence.length && <p className="text-sm text-[var(--text-secondary)]">目前沒有附件。</p>}
              </div>
              {current.upload && <label className="label mt-3 block">補充附件
                <input type="file" className="mt-1 block max-w-full text-sm" disabled={busy} onChange={(event): void => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  void perform(async (): Promise<void> => {
                    setDetail(await kbRequest<CaseDetail>(endpoint("file", { id: current.id, name: file.name }), {
                      method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: file,
                    }));
                    setCatalog(await kbRequest<CaseCatalog>("cases"));
                  }, "已加入附件。");
                }} />
              </label>}
            </details>
            <div ref={ncaSection} tabIndex={-1} aria-label="NCA 列管">
              <NcaPanel key={current.id + current.nca.revision} item={current} busy={busy} onSelectCase={choose}
                onSave={(control: NcaControl): void => void perform(async (): Promise<void> => {
                  setDetail(await kbPost<CaseDetail>("control", { id: current.id, revision: current.nca.revision, control }));
                  setCatalog(await kbRequest<CaseCatalog>("cases"));
                }, "已儲存 NCA 列管。")} />
            </div>
            <ReviewForm key={current.id + current.revision} item={current} terms={catalog?.terms ?? []}
              busy={busy} onSave={(review: CaseReview, notes: string): void => void perform(async (): Promise<void> => {
                setDetail(await kbPost<CaseDetail>("review", { id: current.id, revision: current.revision, review, notes }));
                setCatalog(await kbRequest<CaseCatalog>("cases"));
              }, "已儲存複核。")} />
            <details className="border-t border-[var(--border-color)] pt-3">
              <summary className="cursor-pointer font-medium">8D 草稿（{current.reports.length}）</summary>
              <div className="mt-2 space-y-2">
                {current.reports.map((draft: CaseDraft, index: number) => <button key={draft.id} type="button" className="block text-left text-sm underline"
                  onClick={(): void => onReport(current, draft)}>開啟草稿 {index + 1} · {draft.fields.date || "日期待確認"}</button>)}
                <label className="label block">匯入 8D 草稿
                  <input type="file" accept=".json" className="mt-1 block max-w-full text-sm" disabled={busy || current.status === "missing"} onChange={(event): void => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    void perform(async (): Promise<void> => {
                      if (file.size > 2_000_000) throw new Error("知識庫草稿不得超過 2 MB。");
                      await kbPost("draft", { id: current.id, draft: JSON.parse(await file.text()) });
                      await load();
                    }, "已儲存 8D 草稿。");
                  }} />
                </label>
              </div>
            </details>
            {similar.length > 0 && <details className="border-t border-[var(--border-color)] pt-3">
              <summary className="cursor-pointer font-medium">同品號或同編號案件（{similar.length}）</summary>
              <div className="mt-2 space-y-2">
                {similar.map((item: CaseSummary) => <button type="button" className="block text-left text-sm underline" key={item.id}
                  onClick={(): void => choose(item.id)}>{item.day} · {item.title}</button>)}
              </div>
            </details>}
          </section> : <div className={selected ? "card grid min-h-64 place-items-center" : "card hidden min-h-64 place-items-center lg:grid"}>
            <div className="space-y-3 text-sm text-[var(--text-secondary)]">
              <div className="flex items-center gap-2"><FolderOpen size={20} />{selected ? (message ? "無法開啟案件。" : "正在讀取案件。") : "從清單選擇案件。"}</div>
              {selected && <button className="btn btn-ghost lg:hidden" onClick={(): void => choose("")}>返回清單</button>}
            </div>
          </div>}
        </div>
      </div>

      {preview && <WorkspaceDialog title={fieldName(preview)} onClose={(): void => setPreview("")}>
        {/(\.(png|jpg|jpeg|gif|webp|avif|pdf|txt|csv|mp4|mov|m4a|xlsx?|xlsm|docx))$/i.test(preview) &&
          <iframe className="min-h-[50vh] w-full rounded border border-[var(--border-color)] bg-white" title="附件預覽"
            src={kbBase + endpoint("file", { file: preview, preview: "1" })} />}
        <a className="btn btn-secondary mt-3 inline-flex" href={kbBase + endpoint("file", { file: preview })} download>下載原始檔</a>
      </WorkspaceDialog>}
      {reading && <WorkspaceDialog title={reading.name || "新增經驗筆記"} onClose={(): void => setReading(null)}>
        {message && <p role="alert" className="mb-3 text-sm text-red-700">{message}</p>}
        {editingNote ? <form className="space-y-3" onSubmit={(event): void => {
          event.preventDefault();
          const name = reading.name.endsWith(".md") ? reading.name : reading.name + ".md";
          void perform(async (): Promise<void> => {
            const note = await kbPost<Omit<ExperienceNote, "name">>("note", { ...reading, name });
            setReading({ name, ...note });
            setEditingNote(false);
            await load();
          }, "已儲存經驗筆記。");
        }}>
          {reading.revision === null && <label className="label block">筆記名稱
            <input required className="input mt-1 w-full" value={reading.name} onChange={(event): void => setReading({ ...reading, name: event.target.value })} />
          </label>}
          <label className="label block">筆記內容
            <textarea required rows={10} className="input mt-1 min-h-48 w-full" value={reading.markdown} onChange={(event): void => setReading({ ...reading, markdown: event.target.value })} />
          </label>
          <button className="btn btn-primary" disabled={busy}>儲存經驗筆記</button>
        </form> : <>
          <div className="prose max-w-none dark:prose-invert"><ReactMarkdown skipHtml components={{ img: (): null => null }}>{reading.markdown}</ReactMarkdown></div>
          <button type="button" className="btn btn-secondary mt-3" onClick={(): void => setEditingNote(true)}>編輯經驗筆記</button>
        </>}
      </WorkspaceDialog>}
      {editingTerms && <WorkspaceDialog title="缺陷詞彙" onClose={(): void => setEditingTerms(false)}>
        {message && <p role="alert" className="mb-3 text-sm text-red-700">{message}</p>}
        <TermForm terms={catalog?.terms ?? []} busy={busy} onSave={(term: CaseCatalog["terms"][number], edit: boolean): void => {
          void perform(async (): Promise<void> => {
            await kbPost("term", { term, edit });
            await load();
            setEditingTerms(false);
          }, "已儲存缺陷詞彙。");
        }} />
      </WorkspaceDialog>}
    </div>
  );
}

function WorkspaceDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }): ReactNode {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3">
    <section role="dialog" aria-modal="true" aria-label={title} className="card max-h-[90vh] w-full max-w-4xl overflow-y-auto p-4"
      onKeyDown={(event): void => { if (event.key === "Escape") onClose(); }}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <h2 className="break-all font-semibold">{title}</h2>
        <button type="button" className="btn btn-secondary shrink-0" autoFocus onClick={onClose}>關閉</button>
      </header>
      {children}
    </section>
  </div>;
}

interface ReviewProps {
  item: CaseDetail;
  terms: CaseCatalog["terms"];
  busy: boolean;
  onSave: (review: CaseReview, notes: string) => void;
}

function ReviewForm({ item, terms, busy, onSave }: ReviewProps): ReactNode {
  const [review, setReview] = useState<CaseReview>({ ...emptyReview, ...item.review });
  const [notes, setNotes] = useState(item.notes);
  const field = (key: keyof CaseReview, value: string): void => setReview((previous: CaseReview): CaseReview => ({ ...previous, [key]: value || null }));
  const fileField = (key: "evidence_path" | "verification_path", label: string): ReactNode =>
    <label className="label block">{label}<select aria-label={label} className="input mt-1 w-full" value={review[key] ?? ""} onChange={(event): void => field(key, event.target.value)}>
      <option value="">選擇附件</option>
      {item.evidence.map((file: string) => <option key={file} value={file}>{fieldName(file)}</option>)}
    </select></label>;
  const textField = (key: keyof CaseReview, label: string): ReactNode =>
    <label className="label block">{label}<input className="input mt-1 w-full" value={review[key] ?? ""} onChange={(event): void => field(key, event.target.value)} /></label>;

  return <details open className="border-t border-[var(--border-color)] pt-3">
    <summary className="cursor-pointer font-medium">複核</summary>
    <form className="mt-3 space-y-3" onSubmit={(event): void => { event.preventDefault(); onSave(review, notes); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label block">複核狀態<select className="input mt-1 w-full" value={review.review_status} onChange={(event): void => field("review_status", event.target.value)}>
          {["pending", "reviewed", "closed"].map((key: string) => <option key={key} value={key}>{statuses[key]}</option>)}
        </select></label>
        <label className="label block">確認缺陷<select className="input mt-1 w-full" value={review.defect ?? ""} onChange={(event): void => field("defect", event.target.value)}>
          <option value="">待確認</option>
          {terms.map((term: CaseCatalog["terms"][number]) => <option key={term.id} value={term.id}>{term.label}</option>)}
        </select></label>
        {fileField("evidence_path", "證據附件")}
        {textField("evidence_locator", "證據位置")}
      </div>
      {textField("finding", "判定")}
      <label className="label block">複核筆記<textarea rows={5} className="input mt-1 min-h-28 w-full" value={notes} onChange={(event): void => setNotes(event.target.value)} /></label>
      <details open={review.review_status === "closed"} className="text-sm">
        <summary className="cursor-pointer">措施確效與重複案件</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {fileField("verification_path", "確效附件")}
          {textField("verification_locator", "確效位置")}
          {textField("verification_result", "確效結果")}
          {textField("duplicate_of", "主案 ID")}
        </div>
      </details>
      <button type="submit" className="btn btn-secondary" disabled={busy}>儲存複核</button>
    </form>
  </details>;
}

function TermForm({ terms, busy, onSave }: {
  terms: CaseCatalog["terms"];
  busy: boolean;
  onSave: (term: CaseCatalog["terms"][number], edit: boolean) => void;
}): ReactNode {
  const [selected, setSelected] = useState("");
  const existing = terms.find((term: CaseCatalog["terms"][number]): boolean => term.id === selected);
  return <div className="max-w-lg space-y-3">
    <select aria-label="選擇缺陷詞彙" className="input w-full" value={selected} onChange={(event): void => setSelected(event.target.value)}>
      <option value="">新增缺陷詞彙</option>
      {terms.map((term: CaseCatalog["terms"][number]) => <option key={term.id} value={term.id}>{term.label}</option>)}
    </select>
    <form key={selected} className="space-y-3" onSubmit={(event): void => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      onSave({
        id: existing?.id ?? String(fields.get("id")),
        label: String(fields.get("label")),
        definition: String(fields.get("definition")),
        aliases: String(fields.get("aliases")).split(/\r?\n/).map((alias: string): string => alias.trim()).filter(Boolean),
      }, Boolean(existing));
    }}>
      <label className="label block">缺陷 ID<input className="input mt-1 w-full" name="id" required pattern="[a-z][a-z0-9\\-]{0,47}" defaultValue={existing?.id} readOnly={Boolean(existing)} /></label>
      <label className="label block">名稱<input className="input mt-1 w-full" name="label" required defaultValue={existing?.label} /></label>
      <label className="label block">定義<textarea className="input mt-1 min-h-20 w-full" name="definition" rows={2} required defaultValue={existing?.definition} /></label>
      <label className="label block">同義詞（每行一項）<textarea className="input mt-1 min-h-24 w-full" name="aliases" rows={4} defaultValue={existing?.aliases.join("\n")} /></label>
      <button className="btn btn-primary" disabled={busy}>儲存缺陷詞彙</button>
    </form>
  </div>;
}
