// src/lib/tools/promptBuilder.ts
// 建構增強型的 AI 提示，整合工具描述與 Few-Shot Examples

import { getHistory } from '../historyManager';
import { 
  classifyRootCause, 
  calculateRPN, 
  findSimilarCases,
  checkReportCompleteness 
} from './analysisTools';

/**
 * 生成增強型 5-Why 分析提示
 * 包含角色設定、Few-Shot Examples、工具描述和結構化輸出要求
 */
export function buildEnhanced5WhyPrompt(
  context: string,
  conversationHistory: Array<{ role: string; content: string }>
): string {
  
  const history = getHistory();
  const similarCases = findSimilarCases(
    {
      defectType: extractDefectType(context),
      product: extractProduct(context),
      location: extractLocation(context)
    },
    history
  );
  
  const systemPrompt = `你是一名具備 20 年經驗的資深質量管理顧問，專精於：
1. 8D 問題解決流程（福特/通用汽車標準）
2. 5-Why 根本原因分析
3. FMEA 風險評估
4. 質量改善方法論（Six Sigma, Lean）

## 核心能力
- 識別系統性根本原因 vs 人為疏失
- 區分症狀與病因
- 設計有效的防錯措施（Poka-Yoke）
- 用數據驅動決策

## 回答準則
1. 永遠使用「繁體中文 + 英文對照」
2. 避免空泛描述，必須提供具體數據或案例
3. 每個結論都要有可追溯的邏輯鏈
4. 質疑假設，挑戰表面現象
5. 引導用戶思考「為什麼會這樣」而非直接給答案`;

  const fewShotExamples = `## 【範例對話：好的 5-Why 分析】

**Q1 (專家):** 您提到「產品表面出現刮傷，不良率 15%」，請詳細描述這些刮傷的特徵？
- 位置：是否集中於特定區域？
- 形態：線性、不規則、還是周期性？
- 尺寸：平均長度、深度？

**A1 (用戶):** 刮痕集中在產品右側邊緣，呈線性，方向一致（由上到下），長度約 3-8mm，深度約 0.2mm。

---

**Q2 (專家):** 您觀察到「方向一致且集中於右側」，這暗示了什麼可能的機製？請考慮以下方向：
1. 作業員慣用手與操作姿態
2. 設備的定位機構
3. 輸送帶的導軌設計

**A2 (用戶):** 可能是作業員右手持工具時，工具邊緣掃過產品右側...

---

**Q3 (專家):** 讓我們驗證這個假設。請提供以下資訊：
- 該作業員的培訓記錄
- 工具的防護設計
- 是否有類似案例在歷史中發生？

[檢查歷史案例...]
✅ 發現相似案例：2023年同樣問題，根本原因為「刀具夾具磨損」

**分析：** 這是系統性問題而非單純人員因素。根本原因應指向「預防性維護機制缺失」與「夹具狀態監控不足」。

${similarCases.length > 0 ? `
## 【相關歷史案例】
已從您的報告歷史中找到 ${similarCases.length} 個相似案例，可能有助於分析：
${similarCases.map(c => `- 案例 #${c.caseId}: 相似度 ${c.similarity}%`).join('\n')}
` : ''}`;

  const toolDescription = `
## 【可用分析工具】
您可以使用以下工具來增強分析品質：

1. **根本原因分類** (classifyRootCause)
   - 分類原因類型：系統性/人為/設備/材料/方法/環境
   - 提供置信度分數
   - 列出支援證據

2. **風險評估** (calculateRPN)
   - 計算風險優先數 (RPN = 嚴重度 × 發生頻率 × 偵測難度)
   - 標記高優先級項目

3. **完整性檢查** (checkReportCompleteness)
   - 驗證 8D 各階段是否完整
   - 提供補充建議
`;

  const currentContext = `
## 【當前案例背景】
${context}
`;

  const conversationContext = conversationHistory.length > 0 ? `
## 【對話歷史】
${conversationHistory.map(h => `${h.role === 'user' ? '用戶' : '專家'}: ${h.content.substring(0, 200)}${h.content.length > 200 ? '...' : ''}`).join('\n\n')}
` : '';

  const nextQuestion = conversationHistory.length === 0 
    ? `请根據上述背景，提出第一個分析問題，引導用戶深入描述缺陷的具體現象。問題應涵蓋：
   - 缺陷的物理特徵（形態、尺寸、位置）
   - 發生的時間模式（頻率、持續時間）
   - 受影響的產品範圍

請確保問題專業且具體，避免讓用戶猜测。`
    : `基於用戶的回答和當前對話進展，請提出下一個深化問題。如果已接近找到根本原因，請開始引導總結，並在最後一次回應中包含 [FINISH_ANALYSIS] 標記。`;

  return `${systemPrompt}

${fewShotExamples}

${toolDescription}

${currentContext}
${conversationContext}

---

${nextQuestion}

請以專業、嚴謹的態度進行分析，並確保所有輸出使用「中英文對照」格式。`;
}

/**
 * 生成增強型最終報告提示
 */
export function buildEnhancedReportPrompt(
  analysisSummary: string,
  formData: any
): string {
  
  const template = `# 8D 問題解決報告

## D1: 團隊成立
| 角色 | 姓名 | 職稱 |
|------|------|------|
| 團隊長 | （待填寫） | （待填寫）|
| 成員 | （待填寫） | （待填寫）|

## D2: 問題描述
**問題標題**：${formData.problemTitle || '待定義'}  
**發生時間**：${formData.occurrenceTime || '待確認'}  
**發生地點/線別**：${formData.location || '待確認'}  
**客戶名稱**：${formData.customerName || '待確認'}  
**產品/型號**：${formData.productInfo || '待確認'}  
**不良數量**：${formData.defectQuantity || '待確認'} pcs  

### 缺陷現象詳細描述
${formData.defectDescription || '待補充'}

### 發現方式
${formData.detectionMethod || '待補充'}

### 影響範圍
${formData.impactScope || '待補充'}

### 初步原因猜測
${formData.preliminaryCause || '待補充'}

## D3: 臨時遏制措施 (ICA)
| 措施 | 執行時間 | 負責人 | 驗證方法 | 狀態 |
|------|---------|--------|---------|------|
| 隔離不良品 | 立即執行 | （待填寫） | 檢驗庫存 | 執行中 |
| 加強檢驗 | 立即執行 | （待填寫） | 100% 篩選 | 執行中 |
| 通知客戶 | （待確認） | （待填寫） | 書面確認 | 待執行 |

## D4: 根本原因分析 (RCA)

### 4.1 5-Why 推導過程
\`\`\`
${analysisSummary}
\`\`\`

### 4.2 魚骨圖分析 (Fishbone Diagram)
- **人 (Man)**: （待分析）
- **機 (Machine)**: （待分析）
- **料 (Material)**: （待分析）
- **法 (Method)**: （待分析）
- **環 (Environment)**: （待分析）

### 4.3 根本原因確認
**系統性根因**：（需基於 5-Why 分析結果填寫）

**驗證證據**：
1. 
2. 
3. 

## D5: 矯正措施 (PCA)
| # | 措施內容 | 責任人 | 預計完成日 | 優先級 | 預期效果 |
|---|---------|--------|-----------|-------|---------|
| 1 | （待填寫） |  |  | 高 |  |

## D6: 預防措施
1. （待填寫）
2. （待填寫）

## D7: 措施驗證
**驗證方法**：（待填寫）  
**驗證結果**：（待填寫）  
**追蹤期間**：（待填寫）

## D8: 團隊慶祝
**改善成效**：（待填寫）  
**團隊貢獻**：（待填寫）  
**下一步計劃**：（待填寫）

---
*報告編號：QAR-${formData.date || 'XXXXXX'}-001*  
*生成日期：${new Date().toLocaleDateString('zh-TW')}*  
*報告由 8D Creator AI 協助生成*`;

  const systemPrompt = `你是一名專業技術寫作者，擅長將複雜的質量工程分析轉化為結構完整、說服力強的 8D 報告。

## 寫作準則
1. 使用「中英雙語」格式（每段中文後跟英文翻譯）
2. 避免模糊語言，使用具體數據和量化指標
3. 因果關係要清晰可追溯
4. 改善措施要具備可操作性
5. 強調 systemic fix 而非 procedural fix

## 語言風格
- 專業但易懂
- 數據驅動
- 邏輯嚴密
- 措辭有力（讓閱讀者感受到改善決心）`;

  return `${systemPrompt}

請根據以下資訊生成一份完整的 8D 報告：

---

## 【報告模板】
${template}

---

## 【生成指示】
1. 仔細閱讀分析摘要
2. 填寫所有空白欄位
3. 確保 D4 的根本原因分析邏輯完整
4. D5-D6 的措施要針對根本原因設計
5. 輸出格式必須是純 Markdown，不要有多餘的說明文字`;
}

/**
 * 輔助函數：從上下文中提取關鍵資訊
 */
function extractDefectType(context: string): string {
  // 簡單實現：提取缺陷描述中的關鍵詞
  const matches = context.match(/缺陷|不良|刮傷|鏽蝕|變形|尺寸超差/);
  return matches ? matches[0] : 'general';
}

function extractProduct(context: string): string {
  const match = context.match(/產品[:：]\s*(\S+)/);
  return match?.[1] || 'unknown';
}

function extractLocation(context: string): string {
  const match = context.match(/線別[:：]\s*(\S+)|地點[:：]\s*(\S+)/);
  return match?.[1] || match?.[2] || 'unknown';
}
