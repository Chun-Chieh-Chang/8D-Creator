export const kbBase = "/8D-Creator/api/kb/";

export const ncaLabels = { pending: "待判定", reference: "僅供參考", required: "需開立", issued: "已開立" };
export type NcaStatus = keyof typeof ncaLabels;

export interface NcaDeadline {
  day: string | null;
  basis: "manual" | "estimated" | "pending";
  overdue: boolean;
}

export interface NcaControl {
  status: NcaStatus;
  number: string;
  issuedOn: string;
  issueEvidence: string;
  issueLocator: string;
  disposition: string;
  manualDue: string;
  ncaProgress: string;
  closedOn: string;
  successor: string;
  product: string;
  process: string;
  defectCode: string;
  severity: string;
  wholeLotScrap: boolean;
  containment: string;
  tracing: string;
  outcome: string;
  reinspection: string;
  resultEvidence: string;
  approvedBy: string;
  approvedOn: string;
  approvalReference: string;
  capaProgress: string;
  capaNumber: string;
  capaEvidence: string;
  capaResult: string;
}

export interface CaseSummary {
  id: string;
  title: string;
  day: string;
  category: string;
  status: string;
  products: string[];
  refs: string[];
  hints: string[];
  defect: string | null;
  drafts: number;
  ncaStatus: NcaStatus;
  ncaNumber: string;
  ncaProgress: string;
  ncaDeadline: NcaDeadline | null;
}

export interface CaseReview {
  review_status: string;
  defect: string | null;
  evidence_path: string | null;
  evidence_locator: string | null;
  finding: string | null;
  verification_path: string | null;
  verification_locator: string | null;
  verification_result: string | null;
  duplicate_of: string | null;
}

export interface KnowledgeDraft {
  format: "8d-creator.quality-kb";
  version: 1;
  fields: { date: string; product: string; batch: string; customer: string; defectQuantity: string; problem: string };
  markdown: string;
}

export interface CaseDraft extends KnowledgeDraft {
  id: string;
}

export interface CaseDetail extends CaseSummary {
  source: string;
  locator?: string;
  evidence: string[];
  upload: boolean;
  notes: string;
  review: Partial<CaseReview>;
  errors: string[];
  revision: string;
  reports: CaseDraft[];
  nca: {
    control: NcaControl;
    policy: string;
    deadline: NcaDeadline | null;
    reasons: string[];
    groups: { label: string; cases: { id: string; number: string; date: string }[] }[];
    warnings: string[];
    successorCase: { id: string; number: string } | null;
    revision: string;
  };
}

export interface CaseCatalog {
  cases: CaseSummary[];
  terms: { id: string; label: string; definition: string; aliases: string[] }[];
  categories: Record<string, string>;
  notes: string[];
  gaps: string[];
  issues: string[];
}

export async function kbRequest<T>(route: string, init?: RequestInit): Promise<T> {
  const response = await fetch(kbBase + route, { ...init, cache: "no-store" });
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("無法連到本機案件工作區。");
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "無法完成操作。");
  return result as T;
}

export function kbPost<T>(route: string, value: object): Promise<T> {
  return kbRequest<T>(route, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "無法完成操作。";
}
