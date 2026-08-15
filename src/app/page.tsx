"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import MainForm from "@/components/MainForm";
import { ReportHistoryItem, getHistory, deleteHistory } from "@/lib/historyManager";
import { Menu, Plus, FileText } from "lucide-react";

export default function Home() {
  const [history, setHistory] = useState<ReportHistoryItem[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<ReportHistoryItem | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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

  const handleReportGenerated = (newItem: ReportHistoryItem) => {
    setHistory(getHistory());
    setSelectedHistory(newItem); // Automatically focus on the new item
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
    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Mobile Top Header Bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[var(--bg-surface)] border-b border-[var(--border-color)] z-30 shrink-0 shadow-xs">
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
              8D 報告系統
            </span>
          </div>
        </div>

        <button
          onClick={handleNewReport}
          className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-medium rounded-md hover:bg-[var(--accent-hover)] active:scale-95 transition-all shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          新建
        </button>
      </header>

      {/* Sidebar (Desktop static & Mobile off-canvas drawer) */}
      <Sidebar 
        history={history} 
        onSelectHistory={(report) => {
          setSelectedHistory(report);
          setIsMobileSidebarOpen(false);
        }}
        onDeleteHistory={handleDeleteHistory}
        onNewReport={handleNewReport}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />
      
      {/* 
        Main form with dynamic key to reset state cleanly on item change
      */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <MainForm 
          key={selectedHistory ? selectedHistory.id : 'new'} 
          selectedHistory={selectedHistory}
          onReportGenerated={handleReportGenerated} 
        />
      </main>
    </div>
  );
}
