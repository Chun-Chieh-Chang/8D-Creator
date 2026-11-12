import assert from "node:assert/strict";
import { test } from "node:test";
import { buildControlView, controlDeadline, emptyControl, parseControl, validateControl } from "./control.mjs";

const evidence = "2. 廠內/原始 NCA.txt";
const files = new Set([evidence]);
const create = (id, number, issuedOn, overrides = {}, itemOverrides = {}) => ({
  id, available: true, review: {}, controlRaw: null,
  control: { ...emptyControl, status: "issued", number, issuedOn, issueEvidence: evidence, issueLocator: "第 1 頁",
    product: "R1-1234", process: "射出", defectCode: "D01", severity: "major", ...overrides },
  ...itemOverrides,
});

test("期限只適用於已開立案件，保留人工期限與月底待確認", () => {
  const control = create("A", "NCA-2601001", "2026-01-15", { disposition: "sorting" }).control;
  assert.deepEqual(controlDeadline(control, "2026-02-16"), { day: "2026-02-15", basis: "estimated", overdue: true });
  assert.equal(controlDeadline({ ...control, ncaProgress: "closed" }, "2026-02-16").overdue, false);
  assert.equal(controlDeadline({ ...control, status: "reference" }, "2026-02-16"), null);
  assert.equal(controlDeadline({ ...control, issuedOn: "2026-01-31" }, "2026-03-01").basis, "pending");
  assert.equal(controlDeadline({ ...control, disposition: "return" }, "2026-03-01").day, null);
  assert.equal(controlDeadline({ ...control, disposition: "return", manualDue: "2026-02-18" }, "2026-02-17").basis, "manual");
});

test("第三張已核對的 NCA 提示 CAPA，排除候選、重複及來源失聯", () => {
  const first = create("A", "NCA-2601001", "2026-01-15");
  const second = create("B", "NCA-2602002", "2026-02-15");
  const third = create("C", "NCA-2604003", "2026-04-15", { process: "組立" });
  const items = [first, second, third,
    create("copy", "ＮＣＡ_N2602002", "2026-02-15"),
    create("old", "NCA-2601004", "2026-01-14"),
    create("reference", "NCA-2602005", "2026-02-20", { status: "reference" }),
    create("no-proof", "NCA-2602006", "2026-02-21", { issueEvidence: "" }),
    create("linked-copy", "NCA-2602007", "2026-02-21", {}, { review: { duplicate_of: "B" } }),
    create("missing", "NCA-2602008", "2026-02-22", {}, { available: false }),
  ];
  const view = buildControlView(third, { items, files }, "2026-04-15");
  assert.equal(view.groups[0].cases.length, 3);
  assert.equal(view.groups[1].cases.length, 1);
  assert.equal(view.reasons.length, 1);
  assert.match(view.reasons[0], /同一產品/);
  assert.throws(() => validateControl(third, { ...third.control, number: "NCA_N2602002" }, { items, files }), /已登錄/);
  assert.throws(() => validateControl(third, { ...third.control, issueEvidence: "" }, { items, files }), /開立證據|證據附件/);
});

test("覆驗失敗與 CAPA 確效各自提示，保留已轉開的新單", () => {
  const first = create("A", "NCA-2601001", "2026-01-15", { reinspection: "fail", ncaProgress: "transferred", successor: "N2602002",
    disposition: "rework", capaProgress: "verified", severity: "critical", closedOn: "2026-02-15",
    outcome: "覆驗不合格，轉開新單。", resultEvidence: evidence });
  const second = create("B", "NCA-2602002", "2026-02-15");
  const pending = buildControlView(first, { items: [first], files }, "2026-03-01");
  assert.ok(pending.warnings.some((message) => message.includes("重新隔離")));
  const linked = buildControlView(first, { items: [first, second], files }, "2026-03-01");
  assert.ok(linked.warnings.every((message) => !message.includes("重新隔離")));
  assert.ok(linked.warnings.some((message) => message.includes("CAPA 措施確效")));
  assert.ok(linked.reasons.some((message) => message.includes("嚴重缺點")));
  assert.throws(() => parseControl({ issuedOn: "2026-02-30" }), /欄位值有誤/);
});
