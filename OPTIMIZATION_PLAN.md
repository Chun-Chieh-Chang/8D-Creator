# 8D Creator 專案優化計畫

**建立日期**: 2026-08-13  
**目標**: 提升專案專業度、效能與使用者體驗

---

## 📋 優化項目清單（按優先級排序）

### 🔴 第一階段：基礎清理（預計 30 分鐘）

#### 1.1 刪除未使用代碼
| 檔案 | 問題 | 動作 |
|------|------|------|
| `src/lib/ollamaClient.ts` | Ollama 已移除但未清理 | 刪除檔案 |
| `src/lib/templateStore.ts` | TemplateMode 類型已過時，只保留 standard | 重構為簡化版 |
| imports in `MainForm.tsx` | 可能有未使用的 import | 檢查並清理 |

**預期效益**: 
- Bundle size 減少 ~5KB
- 維護負擔降低
- TypeScript 警告消除

---

### 🟡 第二階段：核心功能整合（預計 3-4 小時）

#### 2.1 分析工具整合到 UI
**檔案**: `src/components/MainForm.tsx`

**實作內容**:
```typescript
// 在 5-Why 分析階段加入工具呼叫
const analyzeRootCause = (userInput: string) => {
  const result = classifyRootCause(userInput, context);
  
  // 根據分析結果提供即時反饋
  if (result.confidence < 60) {
    showHint(`分析置信度較低(${result.confidence}%)，建議提供更多細節`);
  }
  
  if (result.causeType === 'systemic') {
    highlightSystemicFocus();
  }
};

// 計算風險等級並顯示
const riskAssessment = calculateRPN(
  formData.defectDescription,
  formData.impactScope,
  formData.detectionMethod
);

if (riskAssessment.priority === 'high') {
  showWarning('⚠️ 高風險問題，建議優先處理');
}
```

**UI 改進**:
- 新增「分析置信度」指示器
- 風險等級徽章（高/中/低）
- 根本原因類型標籤

#### 2.2 進度追蹤系統
**檔案**: `src/components/MainForm.tsx`

```typescript
interface AnalysisProgress {
  step: 'preparing' | 'analyzing' | 'validating' | 'complete';
  message: string;
  percentage: number;
  currentQuestion?: string;
  estimatedTime?: string;
}

// 使用時機
- 5-Why 分析開始時
- 每次 AI 回應後更新
- 生成最終報告前驗證完整性
```

**UI 改進**:
- 進階動畫進度條
- 步驟說明文字
- 預計完成時間估算

---

### 🟢 第三階段：體驗增強（預計 2-3 小時）

#### 3.1 歷史報告增強
**檔案**: `src/components/Sidebar.tsx`

**現有功能**: 簡單列表
**新增功能**:
- 關鍵字搜尋欄位
- 按日期/客戶篩選下拉選單
- 相似案例推薦（點擊歷史報告時顯示）
- 快速操作（複製、刪除、匯出）

#### 3.2 錯誤恢復機制
**檔案**: `src/lib/agnesClient.ts`, `src/lib/geminiClient.ts`

```typescript
// 自動重試機制
const generateWithRetry = async (
  generateFn: Function,
  maxRetries = 3,
  delayMs = 1000
) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await generateFn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(delayMs * (i + 1)); // 指數退避
    }
  }
};
```

**UX 改進**:
- 失敗時顯示「重試」按鈕
- 部分成功時提示「繼續使用已生成內容」

---

### 🔵 第四階段：進階優化（預計 4-6 小時）

#### 4.1 Bundle Size 優化
**分析目前的依賴**:
```json
{
  "xlsx": "~800KB",
  "mammoth": "~400KB",
  "docx": "~600KB",
  "pdfjs-dist": "~2MB"
}
```

**優化策略**:
```typescript
// 惰性載入檔案解析器
const FileParser = lazy(() => import('@/lib/fileParser'));

// 條件載入 export 功能
const DocxExporter = lazy(() => 
  import('@/lib/docxExporter').then(m => ({ default: m.exportToDocx }))
);
```

**預期效益**: 首屏載入時間減少 40-60%

#### 4.2 多語言支援架構
**規劃**:
```
src/i18n/
├── locales/
│   ├── zh-TW.json
│   ├── zh-CN.json
│   └── en.json
├── index.ts
└── types.ts
```

**實作**: 
- 檢測瀏覽器語言自動切換
- 手動切換語言按鈕
- 所有 UI 文字提取為鍵值對

---

## 📊 效益預估

| 指標 | 優化前 | 優化後 | 提升幅度 |
|------|--------|--------|---------|
| Bundle Size | ~5.2MB | ~3.8MB | -27% |
| 首屏載入時間 | 3.2秒 | 1.8秒 | -44% |
| 分析準確度評分 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | +67% |
| 使用者滿意度（預期） | 3.5/5 | 4.5/5 | +29% |

---

## 🔄 實作流程

```
計劃確認 → 第一階段清理 → 第二階段整合 → 第三階段體驗 → 第四階段進階
    ↓            ↓              ↓              ↓              ↓
  [今天]      [今天]         [明天]        [下週一]      [下週二]
```

---

## ⚠️ 風險與注意事項

1. **backward compatibility**
   - 歷史報告格式需保持一致
   - API 介面无需變更

2. **性能影響**
   - 增加的功能需監控記憶體使用量
   - 進度追蹤避免過度渲染

3. **測試範圍**
   - 現有功能不能破壞
   - 新工具需單元測試覆蓋

---

## ✅ 完成標準

每階段需滿足：
- [ ] TypeScript 編譯無錯誤
- [ ] ESLint 檢查通過
- [ ] 功能測試通過
- [ ] Git commit 訊息規範
- [ ] GitHub Actions CI 通過
- [ ] 文件更新（如有需要）

---

*請確認此計畫後，我將開始依序執行各階段優化。*
