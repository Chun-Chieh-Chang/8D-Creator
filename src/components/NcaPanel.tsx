import { useState } from "react";
import type { ReactNode } from "react";
import { ncaLabels, type CaseDetail, type NcaControl, type NcaStatus } from "@/lib/knowledgeWorkspace";

const dispositions = { "": "待判定", rework: "重工", sorting: "全檢", deviation: "特採", return: "退回供應商", scrap: "報廢" };
const severities = { "": "待確認", critical: "嚴重缺點", major: "主要缺點", minor: "次要缺點" };
const ncaProgress = { open: "處置中", closed: "已結案", transferred: "轉開新單" };
const capaProgress = { pending: "待判定", required: "已確認需開立", issued: "已開立", verified: "已確效" };
type StringField = Exclude<keyof NcaControl, "wholeLotScrap">;

interface Props {
  item: CaseDetail;
  busy: boolean;
  onSave: (control: NcaControl) => void;
  onSelectCase: (id: string) => void;
}

export default function NcaPanel({ item, busy, onSave, onSelectCase }: Props): ReactNode {
  const [form, setForm] = useState<NcaControl>(item.nca.control);
  const { deadline, reasons, warnings, groups, successorCase } = item.nca;
  const field = (key: StringField, value: string): void => setForm((previous: NcaControl): NcaControl => ({ ...previous, [key]: value }));
  const input = (key: StringField, label: string, type = "text", required = false): ReactNode => (
    <label className="label block">{label}
      <input type={type} required={required} className="input mt-1 w-full min-w-0" value={form[key]}
        onChange={(event): void => field(key, event.target.value)} />
    </label>
  );
  const select = (key: StringField, label: string, options: Record<string, string>): ReactNode => (
    <label className="label block">{label}
      <select aria-label={label} className="input mt-1 w-full" value={form[key]} onChange={(event): void => field(key, event.target.value)}>
        {Object.entries(options).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </label>
  );
  const evidence = (key: "issueEvidence" | "resultEvidence" | "capaEvidence", label: string, required = false): ReactNode => (
    <label className="label block">{label}
      <select aria-label={label} required={required} className="input mt-1 w-full" value={form[key]} onChange={(event): void => field(key, event.target.value)}>
        <option value="">選擇附件</option>
        {form[key] && !item.evidence.includes(form[key]) && <option value={form[key]}>原附件失聯</option>}
        {item.evidence.map((file: string) => <option key={file} value={file}>{file.split("/").at(-1)}</option>)}
      </select>
    </label>
  );
  const memo = (key: StringField, label: string): ReactNode => (
    <label className="label block">{label}
      <textarea className="input mt-1 min-h-20 w-full" rows={2} value={form[key]} onChange={(event): void => field(key, event.target.value)} />
    </label>
  );

  return (
    <details open className="border-t border-[var(--border-color)] pt-3">
      <summary className="cursor-pointer font-medium">不良品通知單（NCA） · {ncaLabels[item.ncaStatus]}</summary>
      <form className="mt-3 space-y-4" onSubmit={(event): void => { event.preventDefault(); onSave(form); }}>
        <label className="label block sm:max-w-60">NCA 狀態
          <select aria-label="NCA 狀態" className="input mt-1 w-full" value={form.status}
            onChange={(event): void => field("status", event.target.value as NcaStatus)}>
            {Object.entries(ncaLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        {form.status === "reference" && <p className="text-sm text-[var(--text-secondary)]">參考案件仍可搜尋、補件及製作 8D 報告。</p>}
        {form.status === "required" && <p className="text-sm">請由品管開立 NCA，再回原案登錄。</p>}
        {form.status === "issued" && <>
          <div className="grid gap-3 sm:grid-cols-2">
            {input("number", "NCA 單號", "text", true)}
            {input("issuedOn", "NCA 開立日期", "date", true)}
            {evidence("issueEvidence", "NCA 開立證據", true)}
            {input("issueLocator", "NCA 證據位置", "text", true)}
            {select("disposition", "處置方式", dispositions)}
            {input("manualDue", "人工確認期限", "date")}
          </div>
          <p className="text-sm" aria-live="polite">
            目前期限 {deadline?.day ?? "待確認"}
            {deadline?.basis === "estimated" && "（暫算，請核對廠內日曆）"}
            {deadline?.overdue && " · 已逾目前列管期限"}
          </p>
          {successorCase && <button type="button" className="text-sm underline" onClick={(): void => onSelectCase(successorCase.id)}>
            開啟轉開的新 NCA {successorCase.number}
          </button>}
        </>}

        {(form.status === "required" || form.status === "issued") && <>
          <details className="border-t border-[var(--border-color)] pt-2">
            <summary className="cursor-pointer text-sm font-medium">處置、覆驗與會簽</summary>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {memo("containment", "標示、隔離與通報")}
              {memo("tracing", "批次追溯與停止依據")}
              {select("reinspection", "品管覆驗", { "": "待確認", pass: "合格", fail: "不合格" })}
              {evidence("resultEvidence", "處置結果附件")}
              {select("ncaProgress", "NCA 處置進度", ncaProgress)}
              {input("closedOn", "NCA 結案日期", "date")}
              {input("successor", "轉開的新 NCA 單號")}
              {memo("outcome", "處置結果與過帳紀錄")}
              {input("approvedBy", "核准人或會簽人")}
              {input("approvedOn", "核准日期", "date")}
              {input("approvalReference", "會簽表單或憑證位置")}
            </div>
          </details>
          <details className="border-t border-[var(--border-color)] pt-2">
            <summary className="cursor-pointer text-sm font-medium">CAPA 判定與措施確效</summary>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {input("product", "確認品號")}
              {input("process", "確認製程")}
              {input("defectCode", "缺點代碼")}
              {select("severity", "缺點等級", severities)}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.wholeLotScrap}
                  onChange={(event): void => setForm((previous: NcaControl): NcaControl => ({ ...previous, wholeLotScrap: event.target.checked }))} />
                處置判定為整批報廢
              </label>
              {select("capaProgress", "CAPA 進度", capaProgress)}
              {input("capaNumber", "CAPA 單號")}
              {evidence("capaEvidence", "CAPA 措施確效附件")}
              {memo("capaResult", "CAPA 措施確效結果")}
            </div>
          </details>
        </>}

        {form.status === item.ncaStatus && (reasons.length > 0 || warnings.length > 0 || groups.length > 0) && (
          <div className="rounded-md border border-[var(--border-color)] p-3 text-sm space-y-2" aria-live="polite">
            {reasons.length > 0 && <div>
              <p className="font-semibold">{["issued", "verified"].includes(item.nca.control.capaProgress) ? "CAPA 開立依據" : "CAPA 提示：須開立"}</p>
              <ul className="list-disc pl-5">{reasons.map((reason: string) => <li key={reason}>{reason}</li>)}</ul>
            </div>}
            {groups.map((group: CaseDetail["nca"]["groups"][number]) => <div key={group.label} className="flex flex-wrap items-center gap-2">
              <span>同{group.label}已核對的 NCA（{group.cases.length} 張）</span>
              {group.cases.map((match: CaseDetail["nca"]["groups"][number]["cases"][number]) => (
                <button key={match.id} type="button" className="underline" onClick={(): void => onSelectCase(match.id)}>{match.number}（{match.date}）</button>
              ))}
            </div>)}
            {warnings.length > 0 && <ul className="list-disc pl-5">{warnings.map((warning: string) => <li key={warning}>{warning}</li>)}</ul>}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-secondary" disabled={busy}>儲存 NCA 列管</button>
          <span className="text-xs text-[var(--text-secondary)]">{item.nca.policy}</span>
        </div>
      </form>
    </details>
  );
}
