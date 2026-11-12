# 8D Creator 操作與架構指南

## 設定 AI 模型

本機服務會先偵測專案 Agent。可用時，側邊欄顯示連線狀態，並使用該 Agent 進行 5-Why 和產生 8D 報告。若未偵測到 Agent，使用下列步驟設定備援模型。[本機 AI 連線](./docs/案件工作區.md#ai-連線)

1. 在側邊欄開啟「AI 設定」。
2. 選擇模型。
3. 輸入 API 金鑰。
4. 選取「測試連線」。
5. 選取「儲存設定」。

若使用自訂模型，輸入模型 ID 和 API 基礎網址。

瀏覽器在 `localStorage` 儲存 AI 設定。Agnes AI 客戶端會在部分連線失敗時重試，最多 3 次。

## 產生 8D 報告

1. 填寫報告資料。
2. 選取「開始分析」。
3. 回答 5-Why 問題。
4. 在「匯出報告」查看報告。
5. 選擇匯出格式。

若要略過 5-Why 問答，選取「跳過分析並產生報告」。

若要將報告連到異常案件，選取「匯出知識庫草稿」。依 [異常知識庫整合藍圖](./docs/異常知識庫整合藍圖.md) 匯入草稿。

## 開啟歷史報告

1. 在側邊欄搜尋「歷史報告」。
2. 選取報告。

瀏覽器在 `localStorage` 保留最近 50 筆報告。清除網站資料會刪除該瀏覽器的報告。

## 程式入口

| 檔案 | 用途 |
| --- | --- |
| `src/app/page.tsx` | 管理目前報告與歷史報告。 |
| `src/components/MainForm.tsx` | 提供資料輸入、5-Why 原因分析和報告匯出。 |
| `src/components/Sidebar.tsx` | 提供 AI 設定、品牌設定和歷史報告入口。 |
| `src/lib/ai_service.ts` | 儲存 AI 設定並測試連線。 |
| `src/lib/agnesClient.ts`、`src/lib/geminiClient.ts` | 呼叫模型 API。 |
| `src/lib/tools/promptBuilder.ts` | 建立分析和報告提示詞。 |
| `src/lib/tools/analysisTools.ts` | 計算 RPN 並比對相似案件。 |
| `src/lib/fileParser.ts` | 讀取參考附件。 |
| `src/lib/historyManager.ts` | 讀取、儲存及刪除歷史報告。 |
| `src/lib/docxExporter.ts`、`src/lib/htmlExporter.ts`、`src/lib/pdfExporter.ts` | 產生匯出檔案或列印頁面。 |
| `scripts/quality-kb/kb.mjs` | 同步本機知識庫，並匯入 8D 草稿。 |

瀏覽器直接向選定的 API 服務傳送分析資料。GitHub Pages 提供靜態檔案。

## 排查問題

- **模型連線失敗。** 開啟「AI 設定」。檢查 API 金鑰和 API 基礎網址。再選取「測試連線」。
- **找不到歷史報告。** 確認目前使用原來的瀏覽器設定檔和網站網址。
- **匯出 PDF 時沒有列印對話框。** 檢查瀏覽器的彈出視窗與列印設定。

## 建置

1. 執行 `npm run lint:terms`。
2. 執行 `npx tsc --noEmit`。
3. 執行 `npm run build`。
4. 檢查 `out` 中的靜態檔案。

網站的基礎路徑為 `/8D-Creator`。
