# 8D Creator — 開發日誌 (DEV_LOG)

專案開發歷程、設計標準、失敗紀錄 (RCA) 與版更紀錄。本文件隨專案變更同步更新。

---

## 1. 專案目標 (Project Objectives)

建置企業級水準的 AI 8D 問題解決報告系統：

- 支援 Agnes AI 與 Gemini 雙 AI 引擎的 5-Why 引導分析
- 提供專業級報告匯出 (Word / HTML / PDF) 與品牌客製化
- 純前端架構，資料留存瀏覽器本地，無後端依賴

---

## 2. 設計標準 (Design Standards)

### Color Master Palette

| 模式 | 背景 | Surface | 主文字 | 次要文字 | 邊框 |
|------|------|---------|--------|---------|------|
| Light | `#F9FAFB` | `#FFFFFF` | `#111827` | `#6B7280` | `#E5E7EB` |
| Dark | `#0F172A` | `#1E293B` | `#F1F5F9` | `#94A3B8` | `#334155` |

- **字體規範**：全介面最小字體 13px（無障礙合規）
- **設計原則**：企業級乾淨介面、扁平配色、卡片分層、4px 格線
- **對比度**：深色模式達成 WCAG AAA（15.8:1）

---

## 3. 版更紀錄 (Changelog)

| 日期 | 版本 | 內容 |
|------|------|------|
| 2026-08-15 | v0.1.x | 多 Provider 模型適配整合：新增 `lib/ai_service.ts` 統一設定服務（Agnes 官方端點 + Google AI Studio Gemini 3.x/2.5/1.5 全系列 + 自訂 OpenAI-compatible 模型、Base URL 可設定、連線測試）；新增 `AISettingsModal` 進階設定（模型下拉 / API Key / Base URL / 測試連線）；agnes/gemini client 模型改為可設定（保留串流體驗）；相容既有 localStorage 設定；預設模型取自可選清單首位（Gemini 預設 gemini-3.7-flash）；AI 引擎設定收斂為單一入口（Sidebar 僅顯示唯讀狀態卡，符合 MECE） |
| 2026-08-14 | v0.1.x | 專案優化作業：全面清理死碼與冗餘資源（移除未用依賴 pdfjs-dist、AI 工具快取、預設 SVG、無關截圖、死碼 barrel 檔）；同步 README / Wiki / DEV_LOG；修復 19 項 ESLint 問題（未用 import、`any` 型別、setState-in-effect）；新增產品批號欄位與作者資訊；建立版本基準並推送 |
| 2026-08-13 | v0.1.x | 品牌設定面板重構為 CSS Design Tokens（AAA 對比度）；水平掃描對比度強化；企業級乾淨 UI 全面去除 AI 風格化設計 |
| 2026-08-13 | v0.1.x | 專業 HTML 匯出（版本追蹤、品牌客製化、深淺色主題）；結構化問題描述（5W2H 卡片） |
| 2026-08-13 | v0.1.x | P2 改善：8D Dashboard、PDF/Excel 附件解析、AI 風格設定、響應式佈局 |
| 2026-08-13 | v0.1.x | P0+P1：報告完整性檢查、UX 優化、agnes-2.5-flash 模型支援 |
| 2026-08-13 | v0.1.x | 一鍵系統重置與資料清理功能 |
| 2026-08-13 | v0.1.x | PDF 匯出改用瀏覽器列印引擎（絕對可靠性） |
| 2026-08-13 | v0.1.x | 草稿持久化（防重整資料遺失）；匯出檔名與 MIME 修正 |
| 2026-08-13 | v0.1.x | 動態 Ollama 模型選擇 → 改為雲端模型篩選 |
| 2026-08-13 | v0.1.x | 軟體驗證完成、UI 對齊 Color Master Palette、API 錯誤處理強化 |
| 2026-03-24 | v0.1.x | 作者資訊移至主內容頁尾；同步與驗證 (`git pull` + `npm run build`) |
| 2026-03-24 | v0.1.x | War Room 佈局：2 欄輸入表單、步驟導引置頂、使用說明移入側邊欄 |
| 2026-03-24 | v0.1.x | 3 欄 Dashboard 重構與 UI 打磨 |
| 2026-03-24 | v0.1.x | 統一主題系統（手動切換 + 對比度修正）；設定 GitHub Pages basePath |
| 2026-03-24 | v0.0.1 | 初始版本：Ollama + Gemini 本地/雲端雙引擎，3 欄式介面 |

---

## 4. 部署資訊 (Deployment)

- **GitHub Pages**: <https://chun-chieh-chang.github.io/8D-Creator/>
- **Next.js Config**: `output: "export"` + `basePath: "/8D-Creator"`
- **CI/CD**: GitHub Actions (`nextjs.yml`) — 推送到 `main` 即建置部署
- **本地開發**: `npm run dev` → <http://localhost:3000>

---

## 5. 失敗紀錄與 RCA (Failure Logs)

### 案例 A：Cascading Renders 警告
- **現象**：`useEffect` 內同步呼叫 setState 觸發 React 級聯渲染警告
- **修正**：遵循 `page.tsx` 既有模式，將初始化的 setState 延遲至 `requestAnimationFrame` 內執行
- **預防**：ESLint `react-hooks/set-state-in-effect` 規則常駐檢查

### 案例 B：CI Build 失敗 (TS2304)
- **現象**：GitHub Actions build 失敗，`MainForm.tsx` 引用未定義的 `chatEndRef`
- **修正**：補上 `useRef<HTMLDivElement>(null)` 宣告與捲動邏輯
- **預防**：推送前強制執行 `npx tsc --noEmit` + `npm run build`（見 AGENTS.md TypeScript 規則）

### 案例 C：檔案編碼損毀
- **現象**：README 等文件以錯誤編碼提交導致亂碼
- **修正**：全面重寫為 UTF-8 編碼，並納入本次版本基準
- **預防**：文件一律以 UTF-8 撰寫，避免從非 UTF-8 來源直接複製

---

## 6. 維護事項 (Maintenance)

- **Git 追蹤**：`.gitignore` 排除 AI 工具執行快取 (`/.agnes/`)、建置產物 (`/.next/` `/out/` `*.tsbuildinfo`)、環境變數 (`.env*`)、產生檔 (`*.docx`)
- **品質閘門**：推送前依序執行 `npx tsc --noEmit` → `npm run lint` → `npm run build`
- **文件同步**：功能變更後同步更新 README.md / walkthrough.md / DEV_LOG.md

---

*Developed by Wesley Chang @Mouldex, Aug-2026.*