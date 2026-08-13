export interface Template {
  id: string;
  name: string;
  content: string;
}

const DEFAULT_TEMPLATE = `# 8D問題解決報告
報告編號: QAR-{{DATE}}-001 | 問題主題: {{PRODUCT}} 缺陷

## D1: 成立團隊
## D2: 問題描述
    本報告針對 {{PRODUCT}} 於 {{DATE}} 發生的質量問題進行深度解析。
    客戶名稱: {{CUSTOMER}}
    不良數量: {{QUANTITY}}
    詳細描述: {{DESCRIPTION}}

## D3: 臨時遏制措施
## D4: 根本原因分析 (請深入引用 5-Why 的推導過程與附件資料)
    {{5WHY_SUMMARY}}

## D5: 選擇的糾正措施
## D6: 預防措施 (必須針對 5-Why 發現的系統性根因)
## D7: 措施驗證
## D8: 團隊慶祝`;

export const getTemplateContent = (): string => {
  return DEFAULT_TEMPLATE;
};
