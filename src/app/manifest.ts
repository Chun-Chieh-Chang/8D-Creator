import type { MetadataRoute } from "next";

// static export 要求明確標記靜態路由
export const dynamic = "force-static";

/**
 * PWA Web App Manifest
 * 使用相對路徑（./）解析於 manifest 所在位置，相容 GitHub Pages basePath 部署。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "8D Creator - AI 8D 問題解決報告系統",
    short_name: "8D Creator",
    description: "企業級 AI 驅動 8D 問題解決報告系統，支援 5-Why 引導分析、風險評估與多格式匯出",
    start_url: "./",
    scope: "./",
    display: "standalone",
    orientation: "any",
    background_color: "#F9FAFB",
    theme_color: "#1E3A5F",
    categories: ["business", "productivity", "utilities"],
    icons: [
      {
        src: "./icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "./icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "./icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}