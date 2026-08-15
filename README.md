# 8D Creator (AI 8D Problem Solving System)

企業級 AI 驅動 8D 問題解決報告系統。支援 AI 引導 (Agnes AI / Gemini) 的 5-Why 根本原因分析、風險評估 (RPN)、相似案例比對與專業檔案匯出 (Word, HTML, PDF)。

---

## 功能特色 (Features)

- **雙 AI 引擎**：支援 [Agnes AI Hub](https://apihub.agnes-ai.com) 與 Google AI Studio，可即時切換；完整模型適配（Agnes 官方端點 / Gemini 3.x・2.5・1.5 全系列 / 自訂 OpenAI-compatible 閘道），含進階設定面板與連線測試
- **5-Why 專家引導分析**：透過互動對話逐步推導根本原因，自動生成 D1-D8 完整報告
- **風險評估**：依 RPN (嚴重度 × 發生頻率 × 偵測難度) 自動分級高/中/低風險
- **相似案例比對**：從歷史報告中自動尋找相似問題案例
- **完整表單欄位**：問題標題、發生日期/地點、缺陷描述、發現方式、影響範圍、產品/型號、產品批號、客戶名稱、不良數量等
- **多格式匯出**：Word (.docx)、專業 HTML（含版本追蹤與品牌客製化）、PDF
- **歷史報告管理**：localStorage 持久化，支援關鍵字搜尋與客戶篩選
- **品牌設定**：公司名稱、主色、字型、浮水印客製化
- **檔案上傳分析**：支援 Excel / Word / PDF / TXT 附件作為分析背景資料
- **PWA 相容**：可安裝至手機主畫面（Web App Manifest + Service Worker），離線完整可用、iOS/Android 圖示與安全區域支援
- **深淺色主題**：符合 Color Master Palette 規範，全介面最低字體 13px 確保可讀性

---

## 快速開始 (Getting Started)

### 本機開發

```bash
npm install
npm run dev
```

瀏覽器開啟 [http://localhost:3000](http://localhost:3000)

### 品質驗證

```bash
npx tsc --noEmit   # TypeScript 型別檢查
npm run lint       # ESLint 檢查
npm run build      # 生產建置
```

---

## 技術棧 (Tech Stack)

- **Framework**: Next.js 16 (App Router, static export)
- **Styling**: Tailwind CSS v4 + Vanilla CSS Design Tokens
- **Icons**: Lucide React
- **Exporting**: docx (Word), 自訂 HTML/PDF 輸出模板
- **File Parsing**: xlsx, mammoth（動態載入）

---

## 部署 (Deployment)

靜態匯出 (static export) 至 GitHub Pages，見 `.github/workflows/nextjs.yml`。

- 正式站點: <https://chun-chieh-chang.github.io/8D-Creator/>
- 每次推送到 `main` 分支即自動建置部署

---

## 文件索引 (Documentation)

- [DEV_LOG.md](./DEV_LOG.md) — 開發日誌與版更紀錄
- [walkthrough.md](./walkthrough.md) — 架構說明與操作指南（Wiki）
- [AGENTS.md](./AGENTS.md) — 專案開發規則

---

*Developed by Wesley Chang @Mouldex, Aug-2026.*