"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import MainForm from "@/components/MainForm";
import CaseWorkspace from "@/components/CaseWorkspace";
import ModelCatalogNotice from "@/components/ModelCatalogNotice";
import ProjectMap from "@/components/ProjectMap";
import type { CaseDestination, MapDestination } from "@/components/ProjectMap";
import TaskTrail from "@/components/TaskTrail";
import type { CasePosition, ReportPosition } from "@/components/TaskTrail";
import { detectProjectAgent } from "@/lib/generate8D";
import { ReportHistoryItem, getHistory, deleteHistory } from "@/lib/historyManager";
import { kbPost, kbRequest, type CaseDetail, type CaseDraft, type KnowledgeDraft } from "@/lib/knowledgeWorkspace";
import { Menu, Plus, FileText, Power } from "lucide-react";

type WorkspaceView = "cases" | "report" | "map";

export default function Home() {
  const [history, setHistory] = useState<ReportHistoryItem[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<ReportHistoryItem | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [localWorkspace, setLocalWorkspace] = useState(false);
  const [view, setView] = useState<WorkspaceView>("report");
  const [caseNavigation, setCaseNavigation] = useState<{ destination: CaseDestination; caseId?: string }>();
  const [casePosition, setCasePosition] = useState<CasePosition>({ creating: false });
  const [reportPosition, setReportPosition] = useState<ReportPosition>({ step: "input", saved: false, ready: false });
  const [resumeView, setResumeView] = useState<Exclude<WorkspaceView, "map">>();
  const [caseContext, setCaseContext] = useState<CaseDetail>();
  const [caseVersion, setCaseVersion] = useState(0);
  const [formSession, setFormSession] = useState(0);
  const [projectAgent, setProjectAgent] = useState<string | null>();
  const [serverState, setServerState] = useState<"running" | "stopping" | "stopped">("running");
  const [shutdownError, setShutdownError] = useState("");

  useEffect((): (() => void) => {
    const openMapFromLink = (): void => {
      if (window.location.hash === "#map") setView("map");
    };
    const frame = requestAnimationFrame(openMapFromLink);
    window.addEventListener("hashchange", openMapFromLink);
    return (): void => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", openMapFromLink);
    };
  }, []);

  // Load history on mount (Client-side only)
  useEffect(() => {
    // Defer the state update to avoid the "cascading renders" lint error
    // and ensure hydration consistency between server and client.
    requestAnimationFrame(() => {
      const loadedHistory = getHistory();
      if (loadedHistory.length > 0) {
        setHistory(loadedHistory);
      }
    });
  }, []);

  useEffect((): (() => void) => {
    if (serverState !== "running") return (): void => {};
    const controller = new AbortController();
    const refresh = async (): Promise<void> => {
      const agent = await detectProjectAgent(controller.signal);
      if (!controller.signal.aborted) setProjectAgent(agent);
    };
    void refresh();
    const timer = window.setInterval((): void => { void refresh(); }, 30_000);
    return (): void => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [serverState]);

  useEffect((): (() => void) | undefined => {
    if (window.location.hostname !== "127.0.0.1") return;
    const controller = new AbortController();
    void kbRequest<{ local: boolean }>("status", { signal: controller.signal }).then((status: { local: boolean }): void => {
      if (status.local) {
        setLocalWorkspace(true);
        setView((current: WorkspaceView): WorkspaceView => current === "map" ? current : "cases");
      }
    }).catch((): void => {});
    return (): void => controller.abort();
  }, []);

  const openCaseReport = (item: CaseDetail, draft?: CaseDraft): void => {
    setCaseContext(item);
    setSelectedHistory(draft ? {
      id: draft.id,
      caseId: item.id,
      timestamp: 0,
      date: draft.fields.date,
      productInfo: draft.fields.product,
      productBatch: draft.fields.batch,
      customerName: draft.fields.customer,
      defectQuantity: Number(draft.fields.defectQuantity) || 0,
      problemDescription: draft.fields.problem,
      generatedContent: draft.markdown,
    } : null);
    setFormSession((previous: number): number => previous + 1);
    setView("report");
  };

  const saveCaseDraft = async (id: string, draft: KnowledgeDraft): Promise<void> => {
    await kbPost("draft", { id, draft });
    setCaseVersion((previous: number): number => previous + 1);
  };

  const handleReportGenerated = (newItem: ReportHistoryItem) => {
    setHistory(getHistory());
    if (!newItem.caseId) setSelectedHistory(newItem);
  };

  const handleDeleteHistory = (id: string) => {
    deleteHistory(id);
    setHistory(getHistory());
    if (selectedHistory?.id === id) {
      setSelectedHistory(null);
    }
  };

  const handleNewReport = () => {
    setSelectedHistory(null);
    setCaseContext(undefined);
    setFormSession((previous: number): number => previous + 1);
    setIsMobileSidebarOpen(false);
  };

  const showView = (next: WorkspaceView): void => {
    if (next === "map" && view !== "map") setResumeView(view);
    const { pathname, search, hash } = window.location;
    if (next === "map" || hash === "#map") {
      window.history.replaceState(window.history.state, "", pathname + search + (next === "map" ? "#map" : ""));
    }
    setIsMobileSidebarOpen(false);
    setView(next);
  };

  const navigateFromMap = (destination: MapDestination): void => {
    if (destination === "report") {
      showView("report");
      return;
    }
    setCaseNavigation({ destination });
    showView("cases");
  };

  const linkedCaseId = localWorkspace ? caseContext?.id ?? selectedHistory?.caseId : undefined;
  const returnToCase = (): void => {
    if (!linkedCaseId) return;
    setCaseNavigation({ destination: "case-report", caseId: linkedCaseId });
    showView("cases");
  };

  const shutdownServer = async (): Promise<void> => {
    setServerState("stopping");
    setShutdownError("");
    try {
      await kbPost<{ ok: boolean }>("shutdown", {});
      setServerState("stopped");
    } catch {
      setServerState("running");
      setShutdownError("無法關閉伺服器。請檢查本機連線後再試。");
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Mobile Top Header Bar */}
      {view === "report" && <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[var(--bg-surface)] border-b border-[var(--border-color)] z-30 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--bg-base)] text-[var(--text-primary)] active:scale-95 transition-all"
            aria-label="開啟選單"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[var(--accent)] flex items-center justify-center text-white">
              <FileText className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-[var(--text-primary)]">
              8D Creator
            </span>
          </div>
        </div>

        <button
          onClick={handleNewReport}
          className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-medium rounded-md hover:bg-[var(--accent-hover)] active:scale-95 transition-all shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          新增報告
        </button>
      </header>}

      {/* Sidebar (Desktop static & Mobile off-canvas drawer) */}
      <div className={view === "report" ? "contents" : "hidden"}>
        <Sidebar
          projectAgent={projectAgent}
          onOpenMap={(): void => showView("map")}
          history={history}
          onSelectHistory={(report: ReportHistoryItem): void => {
            setCaseContext(undefined);
            setSelectedHistory(report);
            setFormSession((previous: number): number => previous + 1);
            setIsMobileSidebarOpen(false);
          }}
          onDeleteHistory={handleDeleteHistory}
          onNewReport={handleNewReport}
          isOpen={isMobileSidebarOpen}
          onClose={(): void => setIsMobileSidebarOpen(false)}
        />
      </div>
      
      {/* 
        Main form with dynamic key to reset state cleanly on item change
      */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <nav aria-label="工作區" className="flex shrink-0 flex-wrap items-center gap-1 border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 sm:gap-2 sm:px-4">
          <button type="button" aria-pressed={view === "map"} className={view === "map" ? "btn btn-primary text-sm" : "btn btn-ghost text-sm"}
            onClick={(): void => showView("map")}>專案地圖</button>
          {localWorkspace && <button type="button" aria-pressed={view === "cases"} className={view === "cases" ? "btn btn-primary text-sm" : "btn btn-ghost text-sm"}
            onClick={(): void => showView("cases")}>案件工作區</button>}
          <button type="button" aria-pressed={view === "report"} className={view === "report" ? "btn btn-primary text-sm" : "btn btn-ghost text-sm"}
            onClick={(): void => showView("report")}>8D 報告</button>
          {localWorkspace && <button type="button" disabled={serverState !== "running"} onClick={(): void => void shutdownServer()}
            className="btn btn-ghost ml-auto gap-1 text-sm disabled:opacity-60">
            <Power size={16} aria-hidden="true" />
            {serverState === "stopping" ? "正在關閉" : serverState === "stopped" ? "伺服器已關閉" : "關閉伺服器"}
          </button>}
        </nav>
        {serverState === "stopped" && <p role="status" className="shrink-0 border-b border-[var(--border-color)] px-4 py-2 text-sm">
          本機伺服器已停止接受新請求。執行 <code>npm run local</code> 重新啟動後，再重新整理頁面。
        </p>}
        {shutdownError && <p role="alert" className="shrink-0 px-4 py-2 text-sm">{shutdownError}</p>}
        {view !== "map" && <TaskTrail
          view={view}
          task={caseNavigation?.destination}
          casePosition={casePosition}
          reportPosition={reportPosition}
          linkedCase={linkedCaseId ? caseContext?.title ?? linkedCaseId : undefined}
          onMap={(): void => showView("map")}
          onReturnToCase={linkedCaseId ? returnToCase : undefined}
        />}
        {localWorkspace && view !== "map" && <ModelCatalogNotice />}
        {view === "map" && <ProjectMap localWorkspace={localWorkspace} onNavigate={navigateFromMap}
          onResume={resumeView ? (): void => showView(resumeView) : undefined} />}
        {localWorkspace && <div className={view === "cases" ? "flex flex-1 min-h-0" : "hidden"}>
          <CaseWorkspace version={caseVersion} onReport={openCaseReport} navigation={caseNavigation} onPositionChange={setCasePosition} />
        </div>}
        <div className={view === "report" ? "flex flex-1 min-h-0" : "hidden"}>
          <MainForm
            onPositionChange={setReportPosition}
            projectAgent={projectAgent}
            onAgentUnavailable={(): void => setProjectAgent(null)}
            key={formSession + ":" + (selectedHistory?.id ?? "new")}
            selectedHistory={selectedHistory}
            onReportGenerated={handleReportGenerated}
            caseContext={caseContext}
            caseId={linkedCaseId}
            onSaveCaseDraft={localWorkspace ? saveCaseDraft : undefined}
          />
        </div>
      </main>
    </div>
  );
}
