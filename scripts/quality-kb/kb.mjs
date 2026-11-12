import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync,
  renameSync, statSync, unlinkSync, writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import yaml from "js-yaml";
import { assertVaultPath, caseId, draftKey, load, parseDraft, readLocal, vocabulary } from "./model.mjs";
import { marker, render, reviewTemplate } from "./render.mjs";
import { digest, scan } from "./source.mjs";

export function resolved(file) {
  if (existsSync(file)) return realpathSync(file);
  const parent = path.dirname(file);
  if (parent === file) throw new Error(`路徑不存在 ${file}`);
  return path.join(resolved(parent), path.basename(file));
}

export function within(root, file) {
  const relative = path.relative(root, file);
  return !relative || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

export function workspacePaths(values) {
  const configFile = new URL("../../config.json", import.meta.url);
  const config = (!values.source || !values.vault) && existsSync(configFile)
    ? JSON.parse(readFileSync(configFile, "utf8"))?.qualityKb : undefined;
  const source = values.source ?? config?.source;
  const destination = values.vault ?? config?.vault;
  if (typeof source !== "string" || !source.trim() || typeof destination !== "string" || !destination.trim()) {
    throw new Error("請在 config.json 設定 qualityKb.source 與 qualityKb.vault，或指定 --source 和 --vault。");
  }
  const root = resolved(path.resolve(source));
  const vault = resolved(path.resolve(destination));
  if (within(root, vault) || within(vault, root)) throw new Error("來源與儲存庫須為獨立目錄");
  return { root, vault };
}

export function put(vault, file, text) {
  if (readLocal(vault, file) === text) return false;
  const full = assertVaultPath(vault, file);
  mkdirSync(path.dirname(full), { recursive: true });
  const temp = `${full}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, text, { flag: "wx" });
    renameSync(temp, full);
  } finally {
    if (existsSync(temp)) unlinkSync(temp);
  }
  return true;
}

function writeNew(vault, file, text) {
  if (readLocal(vault, file) !== null) return;
  put(vault, file, text);
}

export function withLock(vault, work) {
  mkdirSync(vault, { recursive: true });
  const file = assertVaultPath(vault, ".quality-kb/sync.lock");
  mkdirSync(path.dirname(file), { recursive: true });
  let lock;
  try {
    lock = openSync(file, "wx");
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    throw new Error(`同步鎖存在 ${file}。確認同步器已結束後才可移除。`);
  }
  try {
    writeFileSync(lock, String(process.pid));
    return work();
  } finally {
    closeSync(lock);
    unlinkSync(file);
  }
}

function obsoleteOutputs(vault, generated) {
  const previous = JSON.parse(readLocal(vault, ".quality-kb/outputs.json") ?? "{}");
  const obsolete = [];
  for (const [file, checksum] of Object.entries(previous)) {
    if (generated.has(file)) continue;
    if (!/^(?:缺陷\/[a-z][a-z0-9-]{0,47}|8D 草稿\/QA-[a-f0-9]{16}-[a-f0-9]{24})\.md$/.test(file)) {
      throw new Error(`無法移除非衍生頁面 ${file}`);
    }
    const before = readLocal(vault, file);
    if (before === null) continue;
    if (digest(before) !== checksum) throw new Error(`已編輯的衍生頁面需先移至手寫筆記 ${file}`);
    obsolete.push(file);
  }
  return obsolete;
}

export function sync(root, vault, state) {
  const generated = render(root, state);
  const obsolete = obsoleteOutputs(vault, generated);
  for (const [file, content] of generated) {
    const before = readLocal(vault, file);
    if (before !== null && before !== content && !before.split(/\r?\n/).includes(marker)) {
      throw new Error(`衍生頁面與現有筆記同名，請先移動現有筆記 ${file}`);
    }
  }
  // Persist identity first so a retried run can reproduce notes after an interruption.
  put(vault, ".quality-kb/registry.json", JSON.stringify(state.registry, null, 2) + "\n");
  writeNew(vault, "詞彙表.yml", yaml.dump(vocabulary, { lineWidth: -1 }));
  writeNew(vault, "source-aliases.json", "{}\n");
  for (const item of state.items) writeNew(vault, item.reviewPath, reviewTemplate(item));
  let updated = 0;
  for (const [file, content] of generated) updated += Number(put(vault, file, content));
  for (const file of obsolete) unlinkSync(assertVaultPath(vault, file));
  put(vault, ".quality-kb/outputs.json", JSON.stringify(Object.fromEntries([...generated].map(([file, content]) => [file, digest(content)])), null, 2) + "\n");
  console.log(`同步完成。來源記錄 ${state.cases.length}，檔案 ${state.files.size}，更新索引頁 ${updated}，移除過期索引頁 ${obsolete.length}。`);
}

export function verify(root, vault, state) {
  const generated = render(root, state);
  const problems = obsoleteOutputs(vault, generated);
  const notes = new Set([...generated.keys(), ...state.items.filter((item) => item.reviewRaw !== null).map((item) => item.reviewPath)]);
  for (const [file, content] of generated) {
    if (readLocal(vault, file) !== content) problems.push(`索引缺少或過期 ${file}`);
    if (file.startsWith("8D 草稿/")) continue;
    for (const match of content.matchAll(/(?<!\\)\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) {
      if (!notes.has(`${match[1]}.md`)) problems.push(`連結目標不存在 ${file} → ${match[1]}`);
    }
  }
  for (const item of state.items) {
    if (item.reviewRaw === null) problems.push(`複核筆記缺少 ${item.id}`);
    problems.push(...item.errors.map((error) => `${item.id} ${error}`));
  }
  if (problems.length) throw new Error(problems.join("\n"));
  console.log(`驗證通過。${generated.size} 個索引頁、${state.items.length} 份複核筆記、${state.files.size} 個來源檔案路徑。`);
}

function sql(value) {
  if (value.includes("\0")) throw new Error("SQL 欄位含有 NUL");
  return `'${value.replaceAll("'", "''")}'`;
}

export function exportSql(state) {
  const cases = state.items.filter((item) => item.certified);
  const terms = state.terms.filter((term) => cases.some((item) => item.review.defect === term.id));
  const inserts = [
    ...cases.map((item) => `INSERT INTO quality_kb.reviewed_cases VALUES (${sql(item.id)}, ${Number(item.day.slice(0, 4))}, ${sql(item.category)}, ${sql(item.review.review_status)});`),
    ...terms.map((term) => `INSERT INTO quality_kb.defects VALUES (${sql(term.id)}, ${sql(term.label)}, ${sql(term.definition)}, ARRAY[${term.aliases.map(sql).join(", ")}]::text[]);`),
    ...cases.map((item) => `INSERT INTO quality_kb.case_defects VALUES (${sql(item.id)}, ${sql(item.review.defect)});`),
  ];
  return [
    "-- quality-kb v1 | reviewed case projection",
    "BEGIN;",
    "SET LOCAL standard_conforming_strings = on;",
    "CREATE SCHEMA IF NOT EXISTS quality_kb;",
    "CREATE TABLE IF NOT EXISTS quality_kb.reviewed_cases (case_id text PRIMARY KEY, source_year integer NOT NULL, source_category text NOT NULL, review_status text NOT NULL);",
    "CREATE TABLE IF NOT EXISTS quality_kb.defects (defect_id text PRIMARY KEY, label text NOT NULL, definition text NOT NULL, aliases text[] NOT NULL);",
    "CREATE TABLE IF NOT EXISTS quality_kb.case_defects (case_id text PRIMARY KEY REFERENCES quality_kb.reviewed_cases, defect_id text NOT NULL REFERENCES quality_kb.defects);",
    "COMMENT ON TABLE quality_kb.reviewed_cases IS '一列為一筆已複核且仍可回查的主案，排除重複及失聯案件。';",
    "COMMENT ON COLUMN quality_kb.reviewed_cases.source_year IS '來源資料夾標記日期或 CAPA 發出日期的年份。';",
    "COMMENT ON COLUMN quality_kb.reviewed_cases.source_category IS 'internal 廠內、supplier 供應商、customer 客戶、capa 歷史 CAPA。';",
    "COMMENT ON TABLE quality_kb.defects IS '經複核案件所使用的缺陷詞彙。';",
    "COMMENT ON TABLE quality_kb.case_defects IS '已複核主案及其確認缺陷的對應，每案一筆。';",
    "LOCK TABLE quality_kb.reviewed_cases, quality_kb.defects, quality_kb.case_defects IN SHARE ROW EXCLUSIVE MODE;",
    "DELETE FROM quality_kb.case_defects;",
    "DELETE FROM quality_kb.reviewed_cases;",
    "DELETE FROM quality_kb.defects;",
    ...inserts,
    "COMMIT;",
    "",
  ].join("\n");
}

export function attachDraft(vault, state, id, raw) {
  if (!caseId.test(id)) throw new Error("案件 ID 格式無效");
  const draft = parseDraft(raw);
  const item = state.items.find((candidate) => candidate.id === id);
  if (!item?.available || item.reviewRaw === null) throw new Error("請先同步並確認案件 ID");
  const key = draftKey(draft);
  writeNew(vault, `.quality-kb/drafts/${id}/${key}.json`, JSON.stringify(draft));
  return key;
}

function run() {
  const { values, positionals } = parseArgs({
    allowPositionals: true, options: { source: { type: "string" }, vault: { type: "string" } },
  });
  const [command, id, file] = positionals;
  const arity = { sync: 1, verify: 1, attach: 3, "export-sql": 2 };
  if (!Object.hasOwn(arity, command) || arity[command] !== positionals.length) {
    throw new Error("用法：npm run kb -- <sync | verify | attach 案件ID JSON路徑 | export-sql SQL路徑> [--source 路徑] [--vault 路徑]");
  }
  const { root, vault } = workspacePaths(values);
  const readState = () => load(vault, scan(root));
  if (command === "sync") return withLock(vault, () => sync(root, vault, readState()));
  if (command === "verify") return verify(root, vault, readState());
  if (command === "attach") {
    if (statSync(file).size > 2_000_000) throw new Error("8D 草稿不得超過 2 MB");
    const raw = readFileSync(file, "utf8");
    return withLock(vault, () => {
      const key = attachDraft(vault, readState(), id, raw);
      sync(root, vault, readState());
      console.log(`8D 草稿 ${key} 已連到 ${id}。`);
    });
  }
  const output = resolved(path.resolve(id));
  if (within(root, output)) throw new Error("SQL 輸出不可寫到來源目錄");
  const state = readState();
  if (state.items.some((item) => item.errors.length)) throw new Error("請先處理無效的複核屬性，再匯出 SQL");
  writeFileSync(output, exportSql(state), { flag: "wx" });
  console.log(`已匯出 ${state.items.filter((item) => item.certified).length} 筆已複核主案至 ${output}。`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
