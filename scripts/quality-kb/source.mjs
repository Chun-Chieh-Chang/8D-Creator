import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const categories = { 2: "internal", 3: "supplier", 4: "customer" };
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const capaPattern = /^C\d{5}$/i;

export function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function isoDate(value) {
  if (!datePattern.test(value ?? "")) return null;
  const parsed = new Date(value);
  return Number.isNaN(+parsed) || parsed.toISOString().slice(0, 10) !== value ? null : value;
}

function excelDate(value, date1904) {
  if (typeof value !== "number") return isoDate(value);
  const parts = XLSX.SSF.parse_date_code(value, { date1904 });
  if (!parts) return null;
  return isoDate([parts.y, String(parts.m).padStart(2, "0"), String(parts.d).padStart(2, "0")].join("-"));
}

function list(root, relative = "") {
  return readdirSync(path.join(root, relative), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
}

function child(relative, entry) {
  return [relative, entry.name].filter(Boolean).join("/");
}

function filesBelow(root, relative, skipped) {
  const files = [];
  for (const entry of list(root, relative)) {
    const key = child(relative, entry);
    if (entry.isDirectory()) files.push(...filesBelow(root, key, skipped));
    else if (entry.isFile()) files.push(key);
    else skipped.push(key);
  }
  return files;
}

function folderCases(root, relative, category, cases, unmapped, skipped) {
  for (const entry of list(root, relative)) {
    const key = child(relative, entry);
    const day = isoDate(entry.name.slice(0, 10));
    if (entry.isDirectory() && day) {
      cases.push({ key, category, day, title: entry.name.slice(10).replace(/^[\s_-]+/, "") || entry.name,
        files: filesBelow(root, key, skipped), source: key });
    } else if (entry.isDirectory()) folderCases(root, key, category, cases, unmapped, skipped);
    else if (entry.isFile()) unmapped.push(key);
    else skipped.push(key);
  }
}

function capaCases(root, source, cases, issues) {
  const book = XLSX.readFile(path.join(root, source));
  const sheet = book.Sheets["廠內CAPA"];
  if (!sheet?.["!ref"]) throw new Error(`缺少廠內 CAPA 工作表 ${source}`);
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: true, range: { s: { r: 0, c: 0 }, e: range.e } });
  const header = rows.findIndex((row) => String(row[1]).trim() === "Case No." && row[2] === "Summary");
  if (header < 0) throw new Error(`廠內 CAPA 表頭已變更 ${source}`);
  const date1904 = book.Workbook?.WBProps?.date1904 ?? false;
  for (const [offset, row] of rows.slice(header + 1).entries()) {
    const number = String(row[1] ?? "").trim().toUpperCase();
    const locator = `廠內CAPA!A${header + 2 + offset}:F${header + 2 + offset}`;
    if (!number && !row[2] && typeof row[0] !== "number") continue;
    const day = excelDate(row[0], date1904);
    if (!capaPattern.test(number) || !day) {
      issues.push(`${source} · ${locator} 缺少可辨識的 CAPA 編號或發出日期`);
      continue;
    }
    cases.push({ key: `capa:${number}:${day}`, category: "capa", day, capa: number,
      title: String(row[2] ?? "").trim() || number, source, locator, files: [source],
      closedInSource: excelDate(row[4], date1904) });
  }
}

export function evidenceDirectory(item) {
  if (item.category !== "capa") return item.source;
  return `${item.source.split("/")[0]}/案件補件/${item.capa}-${item.day}`;
}

export function scan(root) {
  const cases = [];
  const unmapped = [];
  const issues = [];
  const skipped = [];
  const groups = list(root);
  for (const prefix of [1, 2, 3, 4]) {
    if (groups.filter((entry) => entry.isDirectory() && entry.name.startsWith(`${prefix}.`)).length !== 1) {
      throw new Error(`來源必須包含一個以 ${prefix}. 開頭的目錄`);
    }
  }
  for (const entry of groups) {
    const prefix = entry.name.match(/^([1-4])\./)?.[1];
    if (entry.isDirectory() && categories[prefix]) {
      folderCases(root, entry.name, categories[prefix], cases, unmapped, skipped);
    } else if (entry.isDirectory() && prefix === "1") {
      const files = filesBelow(root, entry.name, skipped);
      const supplements = `${entry.name}/案件補件/`;
      const registers = files.filter((file) => !file.startsWith(supplements) &&
        (/廠內CAPA.*\.xls[xm]?$/i.test(file) || /彙總表.*\.xls[xm]?$/i.test(file)));
      if (registers.length !== 1) throw new Error("來源必須包含一份廠內 CAPA 彙總試算表");
      const records = [];
      capaCases(root, registers[0], records, issues);
      for (const item of records) {
        const folder = evidenceDirectory(item) + "/";
        item.files.push(...files.filter((file) => file.startsWith(folder)));
      }
      cases.push(...records);
      const assigned = new Set([registers[0], ...records.flatMap((item) => item.files)]);
      unmapped.push(...files.filter((file) => !assigned.has(file)));
    } else if (entry.isDirectory()) unmapped.push(...filesBelow(root, entry.name, skipped));
    else if (entry.isFile()) unmapped.push(entry.name);
    else skipped.push(entry.name);
  }
  const files = new Set([...unmapped, ...cases.flatMap((item) => item.files)]);
  return { cases, unmapped, issues, skipped, files };
}

export function hints(item, terms) {
  const text = item.title.normalize("NFKC");
  const ids = [
    ...Array.from(text.matchAll(/(?<![A-Z0-9])(?:NCA[\s_:：-]*N?|N)(\d{7})(?!\d)/gi), (m) => `NCA-${m[1]}`),
    ...(item.capa ? [item.capa] : []),
  ];
  const products = text.match(/(?<![A-Z0-9])(?:R1-\d{3,6}|[A-Z]\d{2}-\d{3}-\d{3}(?:-\d+)?|S[ACB]\d{4}|X\d{4}[A-Z]{2,5})(?![A-Z0-9])/gi) ?? [];
  const concepts = terms.filter((term) => term.aliases.some((alias) => text.toLowerCase().includes(alias.normalize("NFKC").toLowerCase())));
  return { ids: [...new Set(ids)], products: [...new Set(products.map((value) => value.toUpperCase()))], concepts };
}
