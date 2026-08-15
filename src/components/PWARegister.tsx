"use client";

import { useEffect } from "react";

/**
 * PWA Service Worker 註冊（僅 production 啟用，避免開發模式快取干擾）
 */
export default function PWARegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("./sw.js")
        .catch((error: unknown) => {
          console.error("Service Worker 註冊失敗:", error);
        });
    };

    // 避免 load 事件在 React 掛載前已觸發的競態
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}