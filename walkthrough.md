# 8D Reporter Generator - Walkthrough

## 達成事項 (Accomplishments)
本次專案完美復刻了您提供的 `Ref` 資料夾內 8D 報告生成器的核心功能，並且在此基礎上，導入了**「國際數位藝術總監」與「資深全端架構師」**的高標準設計。

### 視覺驗證與操作演示
![全新實施的 Art Director UI 介面](file:///C:/Users/3kids/.gemini/antigravity/brain/3bd9a0b5-96c3-448a-bfce-ecd7c749b7bf/verified_8d_ui_1774167181768.png)
*圖：全新實施的高階 UI，展現了細膩的陰影、現代的 Inter 字體與清晰的層級。*

[點此查看本地測試錄影](file:///C:/Users/3kids/.gemini/antigravity/brain/3bd9a0b5-96c3-448a-bfce-ecd7c749b7bf/local_ui_test_1774167162887.webp)

---
與原本參考圖片中略顯基本的 Streamlit 介面不同，本系統已完全升級為 **高效能的 Next.js 靜態網頁應用 (SPA)**。

### 架構亮點
1. **GitHub Pages Ready**: 全系統為純前端架構 (`output: 'export'`)，這意味著您可以將 `/out` 資料夾裡的靜態檔案，直接免費部署至 GitHub Pages，所有操作均發生在使用者的瀏覽器中。
2. **Local AI Privacy**: 應用不依賴雲端計費 API，而是直接呼叫本地機器上安裝的 `Ollama` (`http://localhost:11434`)。資料不離辦公室網路，確保企業機密安全。
3. **Local Storage History**: 採用與後端脫鉤的架構，用戶的每一份 8D 報告歷史紀錄 (符合 MECE 原則) 都會加密並留存於該用戶瀏覽器的 Local Storage 之中，隨時可一鍵切換查看舊報告。
4. **Client-side `.docx` Export**: 獨立的純前端導出能力，能在瀏覽器內即時將渲染出的報告打包為完美的微軟 Word 下載檔。

### UI / UX 設計美學升級
本次視覺設計全面遵循了您的：**「Color Master Palette」與辦公軟體高階質感需求**。
- **Fluent & Linear Design**: 引入了更具科技感與細膩度的互動回饋 (Micro-interactions)，包含 `focus:ring` 描邊、平滑陰影 (`shadow-[0_10px_40px_-10px_...]`)、漸層圖標背景。
- **佈局拆解 (Mobile First to Desktop Mastery)**: 左側保留了優雅歷史管理與模板選擇欄（Sticky Sidebar），右側則利用 `max-w-4xl mx-auto` 控制視覺寬度，大幅增加呼吸感 (Whitespace)，使表單輸入不會壓迫視覺。
- **互動動畫**: 全新的 Skeleton Loaders 與 Fade-in 結果卡片展示（利用 `animate-in fade-in slide-in-from-bottom`）。按鈕點擊時有 `active:scale-[0.98]` 的物理下沉回饋。
- **Color Logic**:
  - `Base / Surface`: 深色模式採用了 `Slate 900` 搭配 `Slate 800`；淺色則是冷感白 `Cool Gray 50`。
  - `Accent`: 選用飽和度完美控制的 `Royal Blue (#2563EB)` 作為主要的引導操作。
  - `Error / Success`: 給予明確的 `Emerald` 和警示 `Red` 提示。

---

## 本地測試與操作指南 (How to Run)

### 啓動應用
1. 打開終端機進入 `C:\Users\3kids\Downloads\8DReporter`。
2. 執行：
   ```bash
   npm run dev
   ```
3. 在瀏覽器打開 `http://localhost:3000` 即可預覽全新介面。

### 4. 5-Why 交互式分析 (Interactive Analysis)
系統現在支持 AI 引導的根因分析流程，且報告內容採 **中英文對照 (Bilingual)** 格式。
- **引導模式**: AI 會連續追問「為什麼」，直到挖掘到系統性根因。
- **繁體中文**: 嚴格遵守繁體中文輸出規範，禁止簡體。
- **報告整合**: 所有的對話推導都會自動填入 8D 報告的 D4 區塊。

![AI 5-Why 對話介面](/C:/Users/3kids/.gemini/antigravity/brain/3bd9a0b5-96c3-448a-bfce-ecd7c749b7bf/ai_first_why_question_1774171623532.png)
![最終 8D 報告整合成果](/C:/Users/3kids/.gemini/antigravity/brain/3bd9a0b5-96c3-448a-bfce-ecd7c749b7bf/final_8d_report_complete_1774172093222.png)

### 配置 Ollama 跨域設定 (CORS)
由於 GitHub Pages/Localhost 處於瀏覽器環境，必須允許其呼叫本地 Ollama：
請確保您已在本地將 Ollama 配置了 `OLLAMA_ORIGINS="*"`
*   **Windows 設定法**：開啟環境變數設定介面 -> 新增系統變數 `OLLAMA_ORIGINS`，值設為 `*`。設定後重啟 Ollama 主應用程式。

### 部署至 GitHub Pages (GitHub Actions 方式)
1. 將程式碼推送到您的 GitHub 儲存庫（預設分支為 `main`）。
2. 在 GitHub 儲存庫頁面點擊 **Settings** -> **Pages**。
3. 在 **Build and deployment** -> **Source** 下，將選項從 "Deploy from a branch" 改為 **"GitHub Actions"**。
4. 之後每次推送程式碼，GitHub Actions 都會自動抓取並執行 `nextjs.yml` 工作流，完成自動化部署。

