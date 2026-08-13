// src/lib/tools/analysisTools.ts
// 專門用於 8D 報告分析的 AI 工具集合

export interface AnalysisResult {
  causeType: 'systemic' | 'human' | 'equipment' | 'material' | 'method' | 'environment';
  confidence: number; // 0-100
  evidence: string[];
  recommendations: string[];
}

export interface RiskAssessment {
  severity: number; // 1-10
  occurrence: number; // 1-10
  detection: number; // 1-10
  rpn: number; // 嚴重度 × 發生頻率 × 偵測難度
  priority: 'high' | 'medium' | 'low';
}

export interface SimilarCase {
  caseId: string;
  similarity: number; // 0-100
  keyFindings: string[];
  effectiveMeasures: string[];
}

/**
 * 工具 1：根本原因分類與評估
 * 分析用戶輸入，判斷根本原因類型並評估置信度
 */
export function classifyRootCause(
  causeStatement: string,
  context: string
): AnalysisResult {
  // AI 會使用這個工具來分析根本原因
  const result: AnalysisResult = {
    causeType: 'systemic', // 預設值，AI 會根據實際內容調整
    confidence: 75,
    evidence: [],
    recommendations: []
  };
  return result;
}

/**
 * 工具 2：風險優先數 (RPN) 計算
 * 基於 5-Why 分析結果計算風險等級
 */
export function calculateRPN(
  defectDescription: string,
  impactScope: string,
  detectionMethod: string
): RiskAssessment {
  // 模擬 RPN 計算
  const severity = Math.min(10, Math.max(1, defectDescription.length / 50));
  const occurrence = Math.min(10, Math.max(1, impactScope.length / 30));
  const detection = Math.min(10, Math.max(1, 10 - detectionMethod.length / 20));
  
  const rpn = Math.round(severity * occurrence * detection);
  let priority: 'high' | 'medium' | 'low';
  
  if (rpn >= 150) priority = 'high';
  else if (rpn >= 80) priority = 'medium';
  else priority = 'low';
  
  return {
    severity: Math.round(severity),
    occurrence: Math.round(occurrence),
    detection: Math.round(detection),
    rpn,
    priority
  };
}

/**
 * 工具 3：相似歷史案例匹配
 * 從历史记录中尋找相似的品質問題案例
 */
export function findSimilarCases(
  currentProblem: {
    defectType: string;
    product: string;
    location: string;
  },
  history: any[]
): SimilarCase[] {
  // 實作簡易匹配邏輯
  const matches: SimilarCase[] = [];
  
  for (const item of history) {
    let score = 0;
    
    // 產品名稱匹配
    if (item.productInfo?.toLowerCase().includes(currentProblem.product.toLowerCase())) {
      score += 40;
    }
    
    // 地點匹配
    if (item.problemDescription?.includes(currentProblem.location)) {
      score += 30;
    }
    
    // 缺陷描述匹配（簡單關鍵字匹配）
    if (item.problemDescription && currentProblem.defectType) {
      const words1 = item.problemDescription.split(/\s+/);
      const words2 = currentProblem.defectType.split(/\s+/);
      const commonWords = words1.filter(w => words2.includes(w));
      if (commonWords.length > 0) {
        score += commonWords.length * 10;
      }
    }
    
    if (score >= 30) {
      matches.push({
        caseId: item.id,
        similarity: Math.min(100, score),
        keyFindings: [
          `問題：${item.problemDescription?.substring(0, 100)}...`,
          `客戶：${item.customerName}`,
          `不良數量：${item.defectQuantity}`
        ],
        effectiveMeasures: [
          '需要進一步分析原始報告以獲取完整措施'
        ]
      });
    }
  }
  
  return matches.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
}

/**
 * 工具 4：報告完整性檢查
 * 驗證 8D 各階段是否完整填寫
 */
export function checkReportCompleteness(
  reportData: {
    d1?: string;
    d2?: string;
    d3?: string;
    d4?: string;
    d5?: string;
    d6?: string;
    d7?: string;
    d8?: string;
  }
): {
  completeness: number;
  missingSections: string[];
  suggestions: string[];
} {
  const sections = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'];
  const sectionNames = [
    'D1: 團隊成立',
    'D2: 問題描述',
    'D3: 臨時遏制措施',
    'D4: 根本原因分析',
    'D5: 矯正措施',
    'D6: 預防措施',
    'D7: 措施驗證',
    'D8: 團隊慶祝'
  ];
  
  const missing: string[] = [];
  let filledCount = 0;
  
  sections.forEach((section, idx) => {
    if (reportData[section as keyof typeof reportData]) {
      filledCount++;
    } else {
      missing.push(sectionNames[idx]);
    }
  });
  
  const completeness = Math.round((filledCount / sections.length) * 100);
  
  const suggestions: string[] = [];
  if (completeness < 50) {
    suggestions.push('報告尚不完整，建議補充關鍵 section');
  }
  if (missing.includes('D4: 根本原因分析')) {
    suggestions.push('D4 是 8D 的核心，必須包含完整的 5-Why 推導');
  }
  if (missing.includes('D3: 臨時遏制措施')) {
    suggestions.push('臨時遏制措施能防止不良品流出，應優先完成');
  }
  
  return {
    completeness,
    missingSections: missing,
    suggestions
  };
}

/**
 * 工具 5：改善措施有效性預測
 * 基於歷史數據預測矯正措施的效果
 */
export function predictMeasureEffectiveness(
  measure: string,
  causeType: string,
  historicalData: any[]
): {
  predictedReduction: number; // 預計降低百分比
  confidence: number;
  riskFactors: string[];
} {
  // 簡化的效果預測邏輯
  let predictedReduction = 50;
  let confidence = 60;
  const riskFactors: string[] = [];
  
  // 根據措施類型調整
  if (measure.includes('自動化') || measure.includes('防呆')) {
    predictedReduction = 85;
    confidence = 80;
  } else if (measure.includes('培訓') || measure.includes('教育')) {
    predictedReduction = 40;
    confidence = 70;
    riskFactors.push('人員流動可能影響效果');
  } else if (measure.includes('檢修') || measure.includes('維護')) {
    predictedReduction = 60;
    confidence = 75;
  }
  
  // 根據原因類型調整
  if (causeType === 'equipment') {
    if (!measure.includes('設備')) {
      riskFactors.push('措施未直接針對設備問題');
      predictedReduction -= 15;
    }
  } else if (causeType === 'human') {
    if (!measure.includes('培訓') && !measure.includes('SOP')) {
      riskFactors.push('可能需要加強人員訓練');
      predictedReduction -= 10;
    }
  }
  
  return {
    predictedReduction: Math.max(20, predictedReduction),
    confidence: Math.max(50, confidence),
    riskFactors
  };
}
