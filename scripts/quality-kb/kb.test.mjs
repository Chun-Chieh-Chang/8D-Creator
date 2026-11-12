import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import yaml from "js-yaml";

const cli = fileURLToPath(new URL("./kb.mjs", import.meta.url));

test("同步、複核、8D 版本、來源異動與本體投影", () => {
  const fixture = mkdtempSync(path.join(os.tmpdir(), "quality-kb-test-"));
  const source = path.join(fixture, "來源");
  const vault = path.join(fixture, "儲存庫");
  const register = "1. 歷史/廠內CAPA.xls";
  const primary = "2. 廠內/色差/2026-05-01_R1-15198_色差_NCA_N2605001";
  const supplier = "3. 供應商/2026-05-02_R1-15198_色差_N2605001";
  const customer = "4. 客戶/2026-05-03_R1-15198_裂損";
  const evidence = "比對證據.txt";
  const run = (expected, ...args) => {
    const result = spawnSync(process.execPath, [cli, ...args, "--source", source, "--vault", vault], { encoding: "utf8" });
    assert.equal(result.status, expected, result.stderr + result.stdout);
    return result.stdout + result.stderr;
  };
  const read = (relative) => readFileSync(path.join(vault, relative), "utf8");
  const put = (relative, text) => writeFileSync(path.join(vault, relative), text);
  const registry = () => JSON.parse(read(".quality-kb/registry.json"));
  const review = (id, values, body = "人工新增的現場紀錄") => {
    put(`複核/${id}-review.md`, `---\n${yaml.dump(values)}---\n\n${body}\n`);
  };
  try {
    for (const dir of ["1. 歷史", primary, supplier, customer]) {
      mkdirSync(path.join(source, dir), { recursive: true });
    }
    writeFileSync(path.join(source, primary, evidence), "比較樣品及標準");
    writeFileSync(path.join(source, "一般說明.txt"), "unassigned");

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
      ["Issued Date", "Case No.", "Summary"], [45500, "C24001", "歷史尺寸NG"],
      [45501, "C24001", "另一歷史案件"], [45502, "BAD", "待補編號"],
    ]), "廠內CAPA");
    XLSX.writeFile(book, path.join(source, register));
    const original = readFileSync(path.join(source, register));

    assert.match(run(0, "sync"), /來源記錄 5/);
    const index = registry();
    const id = Object.keys(index).find((key) => index[key].key === primary);
    const duplicate = Object.keys(index).find((key) => index[key].key === supplier);
    const caseNote = `案件/${id}.md`;
    assert.ok(id);
    assert.match(read("品號線索.md"), /R1-15198/);
    assert.match(read("待處理.md"), /C24001/);
    assert.match(read("待處理.md"), /NCA-2605001/);
    assert.match(read("待處理.md"), /缺少可辨識的 CAPA/);
    run(0, "verify");
    assert.match(run(0, "sync"), /更新索引頁 0/);
    assert.deepEqual(readFileSync(path.join(source, register)), original);

    const report = path.join(fixture, "draft.json");
    writeFileSync(report, JSON.stringify({ format: "8d-creator.quality-kb", version: 1, fields: {}, markdown: "" }));
    run(1, "attach", id, report);
    const draft = {
      format: "8d-creator.quality-kb", version: 1,
      fields: { date: "2026-05-01", product: "R1-15198", batch: "批次", customer: "僅留本機", defectQuantity: "1", problem: "色差" },
      markdown: "## D4 待確認\n~~~\n![[遠端圖片]]",
    };
    writeFileSync(report, JSON.stringify(draft));
    run(1, "attach", "QA-0000000000000000", report);
    run(0, "attach", id, report);
    assert.match(run(0, "attach", id, report), /更新索引頁 0/);
    assert.match(read(caseNote), /kb_status: pending/);
    assert.equal(readdirSync(path.join(vault, "8D 草稿")).length, 1);
    assert.match(read(`8D 草稿/${readdirSync(path.join(vault, "8D 草稿"))[0]}`), /\n~~~~\n/);
    writeFileSync(report, JSON.stringify({ ...draft, markdown: "## D4 修訂" }));
    run(0, "attach", id, report);
    assert.equal(readdirSync(path.join(vault, "8D 草稿")).length, 2);

    const fields = { review_status: "closed", defect: "color", evidence_path: `${primary}/${evidence}`, evidence_locator: "第 1 行", finding: "僅留本機的判定" };
    review(id, fields);
    assert.match(run(1, "verify"), /結案需存在的確效證據/);
    run(1, "export-sql", path.join(fixture, "reject.sql"));
    fields.review_status = "reviewed";
    review(id, fields);
    review(duplicate, { review_status: "pending", duplicate_of: id });
    const manual = read(`複核/${id}-review.md`);
    run(0, "sync");
    run(0, "verify");
    assert.equal(read(`複核/${id}-review.md`), manual);
    const sql = path.join(fixture, "reviewed.sql");
    assert.match(run(0, "export-sql", sql), /1 筆/);
    assert.doesNotMatch(readFileSync(sql, "utf8"), /R1-15198|比對證據|僅留本機|D4/);
    run(1, "export-sql", sql);
    run(1, "export-sql", path.join(source, "reject.sql"));

    const renamed = primary + "-補件";
    renameSync(path.join(source, primary), path.join(source, renamed));
    put("source-aliases.json", JSON.stringify({ [renamed]: id }));
    fields.evidence_path = `${renamed}/${evidence}`;
    review(id, fields);
    mkdirSync(path.join(source, "4. 客戶", "2026-05-04_新增案件"));
    run(0, "sync");
    run(0, "verify");
    assert.equal(registry()[id].key, renamed);
    assert.equal(Object.keys(registry()).length, 6);
    assert.match(read(caseNote), /kb_status: reviewed/);

    renameSync(path.join(source, renamed), path.join(fixture, "暫移"));
    run(0, "sync");
    assert.match(read(caseNote), /kb_status: missing/);
    assert.match(run(1, "verify"), /需有效缺陷、存在的證據檔/);
    assert.equal(readdirSync(path.join(vault, "8D 草稿")).length, 2);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
