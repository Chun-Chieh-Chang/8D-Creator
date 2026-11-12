# 8D Creator

8D Creator 使用 5-Why 分析根本原因，並產生 8D 報告。本機版優先使用專案 Agent。未偵測到 Agent 時，可在「AI 設定」選擇 Agnes AI 或 Gemini。

## 功能

- 填寫報告資料。可加入 Excel、Word、PDF 或 TXT 參考附件。
- 用 5-Why 分析根本原因。查看風險優先數（RPN）和相似案件。
- 產生 8D 報告。可匯出 Word、HTML、PDF 或知識庫草稿。
- 從「歷史報告」開啟已儲存的報告。可按客戶名稱篩選。
- 在「品牌設定」選擇報告的字型、配色和浮水印。
- 在手機上將應用程式加入主畫面。使用模型 API 時需要網路連線。

## 技術

- Next.js App Router 產生靜態頁面。
- Tailwind CSS 與 CSS 變數控制介面樣式。介面支援深色和淺色主題。
- Lucide 提供圖示。SheetJS 和 Mammoth 讀取附件。

## 本機開發

1. 執行 `npm ci`。
2. 執行 `npm run dev`。
3. 開啟 [本機 8D Creator](http://localhost:3000/8D-Creator)。

## 檢查變更

```bash
npm run lint:terms
npx tsc --noEmit
npm run lint
npm run build
```

## 部署

Next.js 將靜態檔案寫入 `out`。推送至 `main` 時，GitHub Actions 會建置並部署至 [GitHub Pages](https://chun-chieh-chang.github.io/8D-Creator/)。

建置完成後，GitHub Actions 使用 Chromium 檢查本機與遠端地圖、操作入口，以及本機服務停止時的顯示。測試使用臨時來源資料夾與儲存庫。檢查通過後才發佈。

在本機重跑檢查前，先關閉使用連接埠 3188 的本機服務。執行 `npm run build`、`npx playwright install --only-shell chromium` 和 `npm run test:project-map`。

## 專案文件

- [案件工作區與系統圖](./docs/案件工作區.md)
- [用語與寫作規範](./docs/用語與寫作規範.md)
- [操作與架構指南](./walkthrough.md)
- [異常知識庫整合藍圖](./docs/異常知識庫整合藍圖.md)
- [開發日誌](./DEV_LOG.md)
- [開發規則](./AGENTS.md)

*Developed by Wesley Chang @Mouldex, Aug-2026.*
