"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import MainForm from "@/components/MainForm";
import { ReportHistoryItem, getHistory, deleteHistory } from "@/lib/historyManager";

export default function Home() {
  const [history, setHistory] = useState<ReportHistoryItem[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<ReportHistoryItem | null>(null);

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

  return (
    <main className="layout-container md:flex-row h-screen overflow-hidden">
      <Sidebar 
        history={history} 
        onSelectHistory={setSelectedHistory}
        onDeleteHistory={handleDeleteHistory}
      />
      
      {/* 
        Key forces unmount/remount of form when selection changes, 
        ensuring fresh initial state derived from the selected history item or empty defaults.
        Actually, we can just pass the selected history and handle it inside. 
        But using a key is a quick robust trick to reset component state.
      */}
      <MainForm 
        key={selectedHistory ? selectedHistory.id : 'new'} 
        selectedHistory={selectedHistory}
        onReportGenerated={handleReportGenerated} 
      />
    </main>
  );
}
