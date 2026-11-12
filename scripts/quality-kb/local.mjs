import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { pipeline } from "node:stream/promises";
import yaml from "js-yaml";
import XLSX from "xlsx";
import mammoth from "mammoth";
import { attachDraft, exportSql, put, resolved, sync, within, withLock, workspacePaths } from "./kb.mjs";
import { assertVaultPath, categories, readLocal } from "./model.mjs";
import { reviewTemplate } from "./render.mjs";
import { digest, evidenceDirectory, isoDate, scan } from "./source.mjs";
import { load } from "./model.mjs";
import { buildControlView, controlDeadline, controlPath, controlPolicy, parseControl, validateControl } from "./control.mjs";
import { createProjectAgent } from "./projectAgent.mjs";
import { createModelCatalog } from "./modelCatalog.mjs";

const { values } = parseArgs({ options: {
  port: { type: "string", default: "3188" },
  source: { type: "string" },
  vault: { type: "string" },
} });
const { root, vault } = workspacePaths(values);
const site = fileURLToPath(new URL("../../out/", import.meta.url));
const base = "/8D-Creator";
const api = base + "/api/kb/";
const port = Number(values.port);
const host = `127.0.0.1:${port}`;
const origin = `http://${host}`;
const projectAgent = createProjectAgent();
const checkModelCatalog = createModelCatalog();
const fileTypes = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".txt": "text/plain; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".avif": "image/avif", ".pdf": "application/pdf", ".woff2": "font/woff2",
  ".mp4": "video/mp4", ".mov": "video/quicktime", ".m4a": "audio/mp4",
};
const inlineTypes = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".pdf", ".txt", ".csv", ".mp4", ".mov", ".m4a"]);
const reviewKeys = ["review_status", "defect", "evidence_path", "evidence_locator", "finding",
  "verification_path", "verification_locator", "verification_result", "duplicate_of"];

if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("請指定 1024 至 65535 的連接埠。");
if (!existsSync(path.join(site, "index.html"))) throw new Error("請先執行 npm run build。");

function readState() {
  return load(vault, scan(root));
}

function respond(res, value, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
}

async function body(req, maxBytes) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("檔案超過大小限制。");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function safeName(value) {
  if (typeof value !== "string" || !value || value.length > 140 ||
    /[<>:"/\\|?*\x00-\x1f]|[. ]$|^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)) {
    throw new Error("名稱含有無法儲存的字元，或超過 140 字。");
  }
  return value;
}

function summary(item) {
  const status = !item.available ? "missing" : item.errors.length ? "invalid" : item.review.duplicate_of ? "duplicate" : item.review.review_status;
  return {
    id: item.id, title: item.title, day: item.day, category: item.category, status,
    products: item.products, refs: item.ids, hints: item.concepts.map((term) => term.id),
    defect: item.certified ? item.review.defect : null, drafts: item.drafts.length,
    ncaStatus: item.control.status, ncaNumber: item.control.status === "issued" ? item.control.number : "",
    ncaProgress: item.control.ncaProgress,
    ncaDeadline: controlDeadline(item.control, taipeiToday()),
  };
}

function taipeiToday() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(new Date());
}

function caseById(state, id) {
  const item = state.items.find((candidate) => candidate.id === id);
  if (!item) throw new Error("找不到案件。請重新整理案件清單。");
  return item;
}

function splitReview(raw) {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)/.exec(raw);
  if (!match) throw new Error("複核筆記的屬性格式有誤。");
  return { fields: yaml.load(match[1], { schema: yaml.JSON_SCHEMA }), notes: match[2].trim() };
}

function detail(state, item) {
  const raw = item.reviewRaw ?? reviewTemplate(item);
  const evidence = [...new Set([...item.files, item.review.evidence_path, item.review.verification_path,
    item.control.issueEvidence, item.control.resultEvidence, item.control.capaEvidence])]
    .filter((file) => state.files.has(file));
  const notes = /^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)([\s\S]*)/.exec(raw)?.[1].trim() ?? raw;
  return { ...summary(item), source: item.source, locator: item.locator, evidence, notes,
    upload: item.available, review: item.review, errors: item.errors,
    revision: digest(item.reviewRaw ?? ""), reports: item.drafts.map(({ file, draft }) => ({ id: file.slice(0, -5), ...draft })),
    nca: buildControlView(item, state, taipeiToday()),
  };
}

function saveReview(state, item, payload) {
  if (digest(item.reviewRaw ?? "") !== payload.revision) throw new Error("複核筆記已更新。重新整理案件後再儲存。");
  if (!payload.review || typeof payload.notes !== "string" || !payload.notes.trim()) throw new Error("請保留複核筆記內容。");
  const fields = { ...splitReview(item.reviewRaw ?? reviewTemplate(item)).fields };
  for (const key of reviewKeys) {
    const value = payload.review[key];
    if (typeof value !== "string" && value !== null) throw new Error("複核欄位格式有誤。");
    fields[key] = value?.trim() || null;
  }
  const raw = `---\n${yaml.dump(fields, { lineWidth: -1 })}---\n\n${payload.notes.trim()}\n`;
  const candidate = load(vault, state, new Map([[item.id, raw]]));
  const next = caseById(candidate, item.id);
  const affected = candidate.items.filter((other) => other.id === item.id || other.review.duplicate_of === item.id);
  const errors = affected.flatMap((other) => other.errors);
  if (errors.length) throw new Error(errors.join("。"));
  put(vault, item.reviewPath, raw);
  sync(root, vault, candidate);
  return detail(candidate, next);
}

async function stream(res, file, type, headers = {}) {
  res.writeHead(200, { "Content-Type": type, "Content-Length": statSync(file).size, ...headers });
  await pipeline(createReadStream(file), res);
}

function attachmentName(file) {
  return "attachment; filename*=UTF-8''" + encodeURIComponent(path.basename(file)).replaceAll("'", "%27");
}

function indexedFile(state, key) {
  if (!state.files.has(key)) throw new Error("找不到索引中的附件。");
  const file = resolved(assertVaultPath(root, key));
  if (!within(root, file) || !statSync(file).isFile()) throw new Error("無法開啟附件。");
  return file;
}

async function evidence(req, res, url) {
  const file = indexedFile(readState(), url.searchParams.get("file"));
  const ext = path.extname(file).toLowerCase();
  if (url.searchParams.has("preview") && [".docx", ".xls", ".xlsx", ".xlsm"].includes(ext)) {
    if (statSync(file).size > 20_000_000) throw new Error("附件過大。請匯出原始檔。");
    let text;
    if (ext === ".docx") text = (await mammoth.extractRawText({ path: file })).value;
    else {
      const workbook = XLSX.readFile(file, { sheetRows: 100 });
      text = workbook.SheetNames.map((name) => name + "\n" + XLSX.utils.sheet_to_csv(workbook.Sheets[name], { FS: "\t" })).join("\n\n");
    }
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    res.end(text.slice(0, 300_000));
    return;
  }
  const inline = url.searchParams.has("preview") && inlineTypes.has(ext);
  await stream(res, file, inline ? (fileTypes[ext] ?? "text/plain; charset=utf-8") : "application/octet-stream",
    { "Cache-Control": "no-store", ...(inline ? {} : { "Content-Disposition": attachmentName(file) }) });
}

async function handleApi(req, res, url) {
  const route = url.pathname.slice(api.length);
  if (req.method === "GET") {
    if (route === "status") return respond(res, { local: true });
    if (route === "agent") return respond(res, await projectAgent.status());
    if (route === "model-check") return respond(res, await checkModelCatalog());
    if (route === "file") return evidence(req, res, url);
    const state = readState();
    if (route === "cases") {
      const notesDir = path.join(vault, "經驗");
      const notes = existsSync(notesDir) ? readdirSync(assertVaultPath(vault, "經驗"), { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => entry.name) : [];
      return respond(res, { cases: state.items.map(summary), terms: state.terms, categories, notes,
        gaps: state.unmapped, issues: [...state.issues, ...state.skipped] });
    }
    if (route === "case") return respond(res, detail(state, caseById(state, url.searchParams.get("id"))));
    if (route === "note") {
      const name = safeName(url.searchParams.get("name"));
      const markdown = name.endsWith(".md") && readLocal(vault, `經驗/${name}`);
      if (typeof markdown !== "string") throw new Error("找不到經驗筆記。");
      return respond(res, { markdown, revision: digest(markdown) });
    }
    if (route === "sql") {
      if (state.items.some((item) => item.errors.length)) throw new Error("請先修正複核欄位。");
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": "attachment; filename=quality-kb.sql", "Cache-Control": "no-store" });
      return res.end(exportSql(state));
    }
    return respond(res, { error: "找不到操作。" }, 404);
  }
  if (req.method !== "POST" || req.headers.origin !== origin) return respond(res, { error: "只允許本機工作區的操作。" }, 403);
  const isUpload = route === "file";
  if (!req.headers["content-type"]?.startsWith(isUpload ? "application/octet-stream" : "application/json")) {
    return respond(res, { error: "資料格式有誤。" }, 415);
  }
  const raw = await body(req, isUpload ? 25_000_000 : 2_100_000);
  const payload = isUpload ? null : JSON.parse(raw.toString("utf8"));
  if (route === "shutdown") {
    res.once("finish", () => server.close());
    return respond(res, { ok: true });
  }
  if (route === "agent") {
    if (typeof payload?.prompt !== "string" || !payload.prompt.trim()) {
      return respond(res, { error: "請提供分析或報告資料。" }, 400);
    }
    const result = await projectAgent.generate(payload.prompt);
    return respond(res, result.body, result.status);
  }
  return withLock(vault, () => {
    const state = readState();
    if (route === "sync") {
      sync(root, vault, state);
      return respond(res, { ok: true });
    }
    if (route === "note") {
      const name = safeName(payload.name);
      if (!name.endsWith(".md") || typeof payload.markdown !== "string" || !payload.markdown.trim()) {
        throw new Error("請輸入筆記名稱和內容。");
      }
      const key = `經驗/${name}`;
      const original = readLocal(vault, key);
      if (payload.revision !== (original === null ? null : digest(original))) {
        throw new Error("筆記已更新或名稱已存在。請重新開啟筆記。");
      }
      const markdown = payload.markdown.trim() + "\n";
      put(vault, key, markdown);
      return respond(res, { markdown, revision: digest(markdown) });
    }
    if (route === "term") {
      const term = payload.term;
      if (!term || typeof term.id !== "string" || !/^[a-z][a-z0-9-]{0,47}$/.test(term.id)
        || ![term.label, term.definition].every((value) => typeof value === "string" && value.trim())
        || !Array.isArray(term.aliases) || !term.aliases.every((value) => typeof value === "string" && value.trim())) {
        throw new Error("請填寫有效的缺陷 ID、名稱和定義。");
      }
      const original = state.terms.find((candidate) => candidate.id === term.id);
      if (Boolean(original) !== payload.edit) throw new Error("缺陷 ID 已存在或已變更。請重新選擇。");
      const terms = state.terms.filter((candidate) => candidate.id !== term.id);
      terms.splice(original ? state.terms.indexOf(original) : terms.length, 0, {
        id: term.id, label: term.label.trim(), definition: term.definition.trim(), aliases: [...new Set(term.aliases.map((alias) => alias.trim()))],
      });
      put(vault, "詞彙表.yml", yaml.dump(terms, { lineWidth: -1 }));
      sync(root, vault, readState());
      return respond(res, { ok: true });
    }
    if (route === "new") {
      const prefixes = { internal: "2.", supplier: "3.", customer: "4." };
      const prefix = Object.hasOwn(prefixes, payload.category) && prefixes[payload.category];
      const group = prefix && readdirSync(root, { withFileTypes: true }).find((entry) => entry.isDirectory() && entry.name.startsWith(prefix));
      if (!group || !isoDate(payload.day)) throw new Error("請選擇來源類別並輸入有效日期。");
      const folder = safeName(`${payload.day}_${safeName(payload.title?.trim())}`);
      const key = `${group.name}/${folder}`;
      mkdirSync(assertVaultPath(root, key));
      const next = readState();
      sync(root, vault, next);
      return respond(res, { id: next.items.find((item) => item.key === key).id }, 201);
    }
    const item = caseById(state, isUpload ? url.searchParams.get("id") : payload.id);
    if (route === "review") return respond(res, saveReview(state, item, payload));
    if (route === "control") {
      if (digest(item.controlRaw ?? "") !== payload.revision) throw new Error("NCA 列管資料已更新。請重新開啟案件。");
      const control = parseControl(payload.control);
      validateControl(item, control, state);
      const raw = JSON.stringify({ policy: controlPolicy, ...control }, null, 2) + "\n";
      put(vault, controlPath(item.id), raw);
      item.control = control;
      item.controlRaw = raw;
      return respond(res, detail(state, item));
    }
    if (route === "draft") {
      attachDraft(vault, state, item.id, JSON.stringify(payload.draft));
      sync(root, vault, readState());
      return respond(res, { ok: true });
    }
    if (isUpload) {
      if (!item.available) throw new Error("此案件沒有可補件的資料夾。");
      const key = `${evidenceDirectory(item)}/${safeName(url.searchParams.get("name"))}`;
      const file = assertVaultPath(root, key);
      if (item.category === "capa") mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, raw, { flag: "wx" });
      const next = readState();
      sync(root, vault, next);
      return respond(res, detail(next, caseById(next, item.id)), 201);
    }
    return respond(res, { error: "找不到操作。" }, 404);
  });
}

const server = createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  try {
    const url = new URL(req.url, origin);
    const crossSite = ["cross-site", "same-site"].includes(req.headers["sec-fetch-site"]);
    const opensWorkspace = req.method === "GET" && url.pathname === base + "/"
      && req.headers["sec-fetch-mode"] === "navigate" && req.headers["sec-fetch-dest"] === "document";
    if (req.headers.host !== host || (crossSite && !opensWorkspace)) {
      return respond(res, { error: "只允許本機工作區的操作。" }, 403);
    }
    if (url.pathname.startsWith(api)) return await handleApi(req, res, url);
    if (req.method !== "GET") return respond(res, { error: "找不到操作。" }, 404);
    if (url.pathname === "/") {
      res.writeHead(302, { Location: base + "/" });
      return res.end();
    }
    if (url.pathname !== base && !url.pathname.startsWith(base + "/")) return respond(res, { error: "找不到頁面。" }, 404);
    const relative = decodeURIComponent(url.pathname.slice(base.length)).replace(/^\/+/, "") || "index.html";
    const file = resolved(path.join(site, relative));
    if (!within(site, file) || !existsSync(file) || !statSync(file).isFile()) return respond(res, { error: "找不到頁面。" }, 404);
    await stream(res, file, fileTypes[path.extname(file)] ?? "application/octet-stream");
  } catch (error) {
    if (!res.headersSent) respond(res, { error: error.code === "EEXIST" ? "名稱已存在。請使用其他名稱。" : error.message }, 400);
    else res.destroy();
  }
});
server.listen(port, "127.0.0.1", () => console.log(`在瀏覽器開啟 ${origin}${base}/`));
