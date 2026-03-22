export type TemplateMode = "standard" | "custom" | "uploaded";

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

export const getTemplateMode = (): TemplateMode => {
  if (typeof window === "undefined") return "standard";
  return (localStorage.getItem("8d-template-mode") as TemplateMode) || "standard";
};

export const setTemplateMode = (mode: TemplateMode) => {
  localStorage.setItem("8d-template-mode", mode);
  window.dispatchEvent(new Event("template-settings-changed"));
};

export const getCustomTemplate = (): string => {
  if (typeof window === "undefined") return DEFAULT_TEMPLATE;
  return localStorage.getItem("8d-custom-template") || DEFAULT_TEMPLATE;
};

export const setCustomTemplate = (content: string) => {
  localStorage.setItem("8d-custom-template", content);
  window.dispatchEvent(new Event("template-settings-changed"));
};

export const getUploadedTemplate = (): string => {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("8d-uploaded-template") || "";
};

export const setUploadedTemplate = (content: string) => {
  localStorage.setItem("8d-uploaded-template", content);
  window.dispatchEvent(new Event("template-settings-changed"));
};

export const getActivePromptTemplate = (): string => {
  const mode = getTemplateMode();
  if (mode === "custom") return getCustomTemplate();
  if (mode === "uploaded") return getUploadedTemplate() || DEFAULT_TEMPLATE;
  return DEFAULT_TEMPLATE;
};
