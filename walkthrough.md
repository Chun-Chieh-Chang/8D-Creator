# 8D Creator — Walkthrough（專案 Wiki）

本文件說明 8D Creator 的整體架構、操作流程與部署方式，作為專案 wiki 使用。

---

## 1. 系統概觀

8D Creator 是一套純前端 (SPA, static export) 的 8D 問題解決報告系統。所有操作皆在使用者瀏覽器中完成，資料透過 `localStorage` 持久化，不需後端伺服器。

### 工作流程

```
填寫資訊 (input) → 原因分析 (analysis) → 輸出報告 (final)
```

1. **填寫資訊**：問題標題、發生日期/地點、缺陷描述、發現方式、影響範圍、初步原因猜測、產品/型號、產品批號、客戶名稱、不良數量，並可上傳參考附件
2. **原因分析**：AI 以 5-Why 蘇格拉底式提問引導挖掘根本原因；同時顯示 RPN 風險評估與相似歷史案例
3. **輸出報告**：AI 自動生成 D1-D8 完整報告，可匯出 Word / HTML / PDF 或複製內容

---

## 2. 架構說明

### 目錄結構 (MECE)

```
src/
├── app/                    # Next.js App Router 入口
│   ├── page.tsx            # 主頁面（狀態管理：history / selectedHistory）
│   ├── layout.tsx          # 根佈局
│   ├── globals.css         # 全域樣式與 CSS Design Tokens
│   └── favicon.ico
├── components/
│   ├── MainForm.tsx        # 主表單（3 步驟流程核心）
│   ├── Sidebar.tsx         # 側邊欄（AI 設定 / 歷史紀錄 / 品牌設定入口）
│   └── BrandSettingsPanel.tsx  # 品牌客製化設定彈窗
└── lib/
    ├── agnesClient.ts      # Agnes AI API 客戶端（含指數退避重試）
    ├── geminiClient.ts     # Gemini API 客戶端
    ├── historyManager.ts   # 歷史報告 localStorage 管理
    ├── fileParser.ts       # 附件解析（xlsx/mammoth 動態載入）
    ├── docxExporter.ts     # Word 匯出
    ├── htmlExporter.ts     # 專業 HTML 匯出（版本追蹤 + 品牌設定）
    ├── pdfExporter.ts      # PDF 匯出（列印引擎）
    ├── brandConfig.ts      # 品牌設定持久化
    ├── versionTracker.ts   # 版本管理
    ├── types.ts            # 共用型別
    └── tools/
        ├── analysisTools.ts    # RPN / 相似案例 / 完整性檢查等分析工具
        └── promptBuilder.ts    # AI 提示詞建構（5-Why 與報告模板）
```

### 依賴關係

- `page.tsx` → `Sidebar` / `MainForm` → `lib/*`
- `MainForm` → `agnesClient` / `geminiClient` / `promptBuilder` / `analysisTools` / `historyManager` / `fileParser` / `*Exporter`
- `htmlExporter` → `versionTracker` / `brandConfig`
- 無循環依賴；`analysisTools` 以 `historyManager` 的 `ReportHistoryItem` 型別為輸入

---

## 3. AI 引擎設定

側邊欄可切換 **Agnes AI** 或 **Gemini**：

| 引擎 | 預設模型 | API Key 取得 |
|------|---------|-------------|
| Agnes AI | agnes-2.5-flash | <https://apihub.agnes-ai.com> |
| Gemini | gemini-2.5-flash / 3.5-flash | <https://aistudio.google.com/app/apikey> |

- API Key 僅儲存於瀏覽器 `localStorage`，不經伺服器
- 連線失敗時 Agnes 客戶端自動指數退避重試 (最多 3 次)

---

## 4. 歷史報告管理

- 自動儲存最近 50 筆報告於 `localStorage` (`8d_reporter_history`)
- 支援關鍵字搜尋（產品/問題描述）與客戶下拉篩選
- 點擊歷史紀錄可回填表單並檢視/重匯出該報告

---

## 5. 部署 (GitHub Pages)

```bash
npm run build        # 輸出至 /out（static export, basePath=/8D-Creator）
git push origin main # 觸發 .github/workflows/nextjs.yml 自動建置部署
```

- 正式站點: <https://chun-chieh-chang.github.io/8D-Creator/>
- 協定注意：`next.config.ts` 已設定 `output: "export"` 與 `basePath`

---

## 6. 常見問題

**Q: 生成報告時連線失敗？**
A: 確認 API Key 已設定且有效；Agnes 金鑰請前往 apihub.agnes-ai.com，Gemini 金鑰請前往 Google AI Studio 申請。

**Q: 更換瀏覽器或清除資料後歷史紀錄消失？**
A: 歷史儲存於 localStorage，屬瀏覽器本地資料，不會跨裝置同步。

**Q: PDF 匯出沒反應？**
A: 瀏覽器可能封鎖彈出視窗，請允許 `localhost` 或 GitHub Pages 網域的彈出視窗。

---

*Developed by Wesley Chang @Mouldex, Aug-2026.*