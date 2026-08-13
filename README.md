# 8D 報告智能生成系統 (AI 8D Creator)

企業級 AI 驅動的 8D 問題解決報告生成與分析系統。支援雙 AI 引擎 (Agnes AI / Gemini)、5-Why 根本原因推導、風險評估 (RPN) 與多格式專業匯出 (Word, HTML, PDF)。

---

## 🌟 核心特色 (Features)

- **雙 AI 引擎靈活切換**：支援 Agnes AI Hub 與 Google Gemini AI。
- **5-Why 專家引導分析**：互動式對話進行 5-Why 根本原因拆解與推導。
- **色彩大師規範 (Color Master Palette)**：
  - **Light Mode**：`#F9FAFB` 高質感微灰底、`#FFFFFF` 純白卡片與 `#111827` 高對比文字。
  - **Dark Mode**：`#0F172A` Slate 900 深色底、`#1E293B` Slate 800 卡片與 `#F1F5F9` 舒適亮字。
- **全站 13px+ 讀寫規範**：符合最小字級 13px 標準與高對比欄位視覺。
- **多格式匯出**：一鍵匯出 Word (.docx)、高質感 HTML (.html) 與 PDF 報告。
- **歷史案例記錄**：支援 localStorage 自動儲存、模糊搜尋與客戶篩選。

---

## 🚀 快速開始 (Getting Started)

### 本地開發
```bash
npm install
npm run dev
```
瀏覽器開啟 [http://localhost:3000](http://localhost:3000)。

### 確效與構建
```bash
npx tsc --noEmit
npm run build
```

---

## 🛠️ 技術棧 (Tech Stack)

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4 + Vanilla CSS Design Tokens
- **Icons**: Lucide React
- **Exporting**: docx, html2pdf.js, custom HTML templates

