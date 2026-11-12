import { digest, isoDate } from "./source.mjs";

export const ncaStatuses = ["pending", "reference", "required", "issued"];
export const dispositions = ["rework", "sorting", "deviation", "return", "scrap"];
const choices = {
  status: ncaStatuses,
  disposition: ["", ...dispositions],
  ncaProgress: ["open", "closed", "transferred"],
  severity: ["", "critical", "major", "minor"],
  reinspection: ["", "pass", "fail"],
  capaProgress: ["pending", "required", "issued", "verified"],
};
const dates = new Set(["issuedOn", "manualDue", "closedOn", "approvedOn"]);
export const emptyControl = {
  status: "pending", number: "", issuedOn: "", issueEvidence: "", issueLocator: "",
  disposition: "", manualDue: "", ncaProgress: "open", closedOn: "", successor: "",
  product: "", process: "", defectCode: "", severity: "", wholeLotScrap: false,
  containment: "", tracing: "", outcome: "", reinspection: "", resultEvidence: "",
  approvedBy: "", approvedOn: "", approvalReference: "",
  capaProgress: "pending", capaNumber: "", capaEvidence: "", capaResult: "",
};

export const controlPath = (id) => `.quality-kb/control/${id}.json`;
export const controlPolicy = "M13001 Rev. L（試行）";

export function parseControl(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("NCA 列管資料格式有誤。");
  const result = {};
  for (const [key, fallback] of Object.entries(emptyControl)) {
    const input = Object.hasOwn(value, key) ? value[key] : fallback;
    if (typeof fallback === "boolean") {
      if (typeof input !== "boolean") throw new Error("整批報廢欄位格式有誤。");
      result[key] = input;
      continue;
    }
    if (typeof input !== "string" || input.length > 4000) throw new Error(`NCA 欄位格式有誤 ${key}。`);
    const text = input.trim();
    if ((choices[key] && !choices[key].includes(text)) || (dates.has(key) && text && !isoDate(text))) {
      throw new Error(`NCA 欄位值有誤 ${key}。`);
    }
    result[key] = text;
  }
  return result;
}

function identity(value) {
  return value.normalize("NFKC").toUpperCase().replace(/\s+/g, "");
}

function ncaIdentity(value) {
  return identity(value).replace(/[-_]/g, "").replace(/^NCAN?(?=\d{7}$)|^N(?=\d{7}$)/, "");
}

export function hasIssuedEvidence(control, files) {
  return control.status === "issued" && Boolean(ncaIdentity(control.number) && control.issuedOn
    && control.issueLocator && files.has(control.issueEvidence));
}

export function validateControl(item, control, state) {
  if (control.status === "issued" && !hasIssuedEvidence(control, state.files)) {
    throw new Error("已開立的案件需填寫 NCA 單號、開立日期、證據附件及位置。");
  }
  if (control.status === "issued" && state.items.some((other) => other.id !== item.id && other.available
    && !other.review.duplicate_of && hasIssuedEvidence(other.control, state.files)
    && ncaIdentity(other.control.number) === ncaIdentity(control.number))) {
    throw new Error("此 NCA 單號已登錄。請從清單搜尋主案。");
  }
  for (const key of ["resultEvidence", "capaEvidence"]) {
    if (control[key] && control[key] !== item.control[key] && !state.files.has(control[key])) {
      throw new Error("找不到所選附件。請重新選擇。");
    }
  }
}

function addMonths(day, offset) {
  const date = new Date(day + "T00:00:00Z");
  const original = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + offset);
  const last = new Date(date);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  date.setUTCDate(Math.min(original, last.getUTCDate()));
  return { day: date.toISOString().slice(0, 10), clamped: original > last.getUTCDate() };
}

export function controlDeadline(control, today) {
  if (control.status !== "issued") return null;
  let due = control.manualDue;
  let basis = "manual";
  if (!due) {
    if (!control.issuedOn || !["sorting", "rework"].includes(control.disposition)) return { day: null, basis: "pending", overdue: false };
    const calculated = addMonths(control.issuedOn, 1);
    if (calculated.clamped) return { day: null, basis: "pending", overdue: false };
    due = calculated.day;
    basis = "estimated";
  }
  return { day: due, basis, overdue: control.ncaProgress === "open" && due < today };
}

export function buildControlView(item, state, today) {
  const control = item.control;
  const reasons = [];
  const warnings = [];
  const groups = [];
  if (control.severity === "critical" && control.defectCode) reasons.push("缺點代碼表所列嚴重缺點。");
  if (control.disposition === "scrap" && control.wholeLotScrap) reasons.push("處置判定為整批報廢。");
  const ready = item.available && !item.review.duplicate_of && hasIssuedEvidence(control, state.files)
    && ["major", "minor"].includes(control.severity) && control.defectCode && (control.product || control.process);
  if (ready) {
    const start = addMonths(control.issuedOn, -3).day;
    const peers = state.items.filter((other) => {
      const candidate = other.control;
      return other.available && !other.review.duplicate_of && hasIssuedEvidence(candidate, state.files)
        && candidate.issuedOn >= start && candidate.issuedOn <= control.issuedOn
        && candidate.severity === control.severity && identity(candidate.defectCode) === identity(control.defectCode);
    });
    for (const [key, label] of [["product", "產品"], ["process", "製程"]]) {
      if (!control[key]) continue;
      const group = new Map(peers.filter((other) => identity(other.control[key]) === identity(control[key]))
        .map((other) => [ncaIdentity(other.control.number), { id: other.id, number: other.control.number, date: other.control.issuedOn }]));
      const cases = [...group.values()].sort((a, b) => a.date.localeCompare(b.date));
      groups.push({ label, cases });
      if (cases.length >= 3) reasons.push(`同一${label}在三個月內已有 ${
        cases.length} 張相同主要或次要缺點的 NCA。`);
    }
  }
  const deadline = controlDeadline(control, today);
  const successor = control.successor && state.items.find((other) => other.id !== item.id && other.available
    && !other.review.duplicate_of && hasIssuedEvidence(other.control, state.files)
    && ncaIdentity(other.control.number) === ncaIdentity(control.successor));
  if (control.status === "issued") {
    if (!hasIssuedEvidence(control, state.files)) warnings.push("請核對 NCA 開立證據。");
    if (!control.defectCode || !control.severity || (control.severity !== "critical" && !(control.product || control.process))) {
      warnings.push("請核對缺點代碼、等級及適用的品號或製程，再確認 CAPA 條件。");
    }
    if (!control.disposition) warnings.push("請記錄處置方式。");
    if (!control.containment) warnings.push("請核對標示、隔離與通報。");
    if (["deviation", "scrap"].includes(control.disposition)
      && !(control.approvedBy && control.approvedOn && control.approvalReference)) {
      warnings.push("請依受控表單確認是否需會簽，並記錄核准憑證。");
    }
    if (["rework", "sorting"].includes(control.disposition) && !control.reinspection) warnings.push("重工或全檢後，請記錄品管覆驗。");
    if (control.reinspection === "fail") {
      if (!successor) warnings.push("覆驗不合格。請重新隔離，開立新 NCA 並記錄新單號。");
      if (control.ncaProgress === "closed") warnings.push("覆驗不合格的原單應記錄轉開新單。");
    }
    if (control.ncaProgress === "transferred" && (!control.successor || control.reinspection !== "fail")) {
      warnings.push("請核對覆驗不合格結果及新 NCA 單號。");
    }
    if (control.ncaProgress !== "open" && (!control.closedOn || !control.outcome || !state.files.has(control.resultEvidence))) {
      warnings.push("請補上結案日期、處置結果及證據附件。");
    }
    if (control.disposition === "return" && control.ncaProgress !== "open") warnings.push("請核對退貨過帳紀錄。");
  }
  if (["issued", "verified"].includes(control.capaProgress) && !control.capaNumber) warnings.push("請補登 CAPA 單號。");
  if (control.capaProgress === "verified" && (!control.capaResult || !state.files.has(control.capaEvidence))) {
    warnings.push("請補上 CAPA 措施確效結果及證據。");
  }
  return { control, policy: controlPolicy, deadline, reasons, groups, warnings,
    successorCase: successor ? { id: successor.id, number: successor.control.number } : null,
    revision: digest(item.controlRaw ?? "") };
}
