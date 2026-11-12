import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { digest, hints, isoDate } from "./source.mjs";
import { controlPath, emptyControl, parseControl } from "./control.mjs";

export const vocabulary = [
  { id: "color", label: "色差", definition: "顏色與參考樣品或色彩規格不同。", aliases: ["色差", "顏色異常", "顏色不符", "discoloration", "colour difference", "color difference"] },
  { id: "short-shot", label: "充填不足", definition: "成型時材料未填滿型腔。", aliases: ["射飽", "充填不良", "填充不良", "short shot"] },
  { id: "dimension", label: "尺寸超規", definition: "量測尺寸超過圖面或核准規格。", aliases: ["尺寸超標", "尺寸異常", "尺寸NG", "高度超過", "直徑NG"] },
  { id: "contamination", label: "異物污染", definition: "產品或包裝內有外來物或非預期物質。", aliases: ["異物", "髮絲", "蟲", "混入", "油汙", "油污"] },
  { id: "crack", label: "裂損", definition: "材料出現裂紋或破裂。", aliases: ["裂", "crack", "broken", "破損"] },
  { id: "deformation", label: "變形", definition: "外形偏離核准的形狀。", aliases: ["變形", "歪斜", "deform", "bended", "bent tip"] },
  { id: "leak", label: "漏氣或漏液", definition: "密封路徑逸出流體。", aliases: ["漏氣", "漏水", "漏液", "leak"] },
  { id: "occlusion", label: "流路阻塞", definition: "通道的流量受非預期阻隔。", aliases: ["阻塞", "堵塞", "occlusion"] },
  { id: "detachment", label: "組件脫離", definition: "組配的元件由預定位置脫離。", aliases: ["脫落", "fall off", "comes out"] },
  { id: "shortage", label: "數量或組件短少", definition: "件數或應裝入的組件不足。", aliases: ["短少", "缺件", "少件"] },
];

export const categories = { internal: "廠內", supplier: "供應商", customer: "客戶", capa: "歷史 CAPA" };
export const caseId = /^QA-[a-f0-9]{16}$/;
const termId = /^[a-z][a-z0-9-]{0,47}$/;

export function readLocal(vault, file) {
  const parts = file.split("/");
  let full = vault;
  for (const part of parts) {
    full = path.join(full, part);
    if (!existsSync(full)) return null;
    if (lstatSync(full).isSymbolicLink()) throw new Error(`儲存庫不允許以符號連結代替資料 ${file}`);
  }
  return readFileSync(full, "utf8");
}

function mapping(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} 需為物件`);
  return value;
}

function readJson(vault, file, fallback) {
  const raw = readLocal(vault, file);
  return raw === null ? fallback : JSON.parse(raw);
}

export function load(vault, data, reviewOverrides = new Map()) {
  const aliases = mapping(readJson(vault, "source-aliases.json", {}), "source-aliases.json");
  const terms = yaml.load(readLocal(vault, "詞彙表.yml") ?? yaml.dump(vocabulary), { schema: yaml.JSON_SCHEMA });
  if (!Array.isArray(terms) || terms.some((term) => !termId.test(term?.id ?? "")
    || !nonempty(term.label) || !nonempty(term.definition) || !Array.isArray(term.aliases) || !term.aliases.every(nonempty))
    || new Set(terms.map((term) => term.id)).size !== terms.length) {
    throw new Error("詞彙表需有唯一英文 id、label、definition 與 aliases 字串清單");
  }
  const registry = mapping(readJson(vault, ".quality-kb/registry.json", {}), "registry");
  for (const [id, item] of Object.entries(registry)) {
    if (!caseId.test(id) || typeof item?.key !== "string" || !Array.isArray(item.keys)
      || !Object.hasOwn(categories, item.category) || !isoDate(item.day) || !Array.isArray(item.files)) {
      throw new Error(`案件索引無效 ${id}`);
    }
  }
  const known = new Map(Object.entries(registry).flatMap(([id, item]) => item.keys.map((key) => [key, id])));
  const current = new Set();
  for (const item of data.cases) {
    const prior = known.get(item.key);
    const alias = Object.hasOwn(aliases, item.key) ? aliases[item.key] : undefined;
    if (alias !== undefined && (!caseId.test(alias) || !Object.hasOwn(registry, alias) || (prior && prior !== alias))) {
      throw new Error(`無法將 ${item.key} 對應至 ${alias}`);
    }
    const id = alias ?? prior ?? `QA-${digest(item.key).slice(0, 16)}`;
    if (current.has(id)) throw new Error(`來源識別碰撞 ${id}（${item.key}）`);
    current.add(id);
    registry[id] = { ...item, keys: [...new Set([...(registry[id]?.keys ?? []), item.key])] };
  }
  const items = Object.entries(registry).map(([id, item]) => ({
    ...item, id, available: current.has(id), ...hints(item, terms), errors: [],
  })).sort((a, b) => b.day.localeCompare(a.day) || a.id.localeCompare(b.id));

  const byId = new Map(items.map((item) => [item.id, item]));
  for (const item of items) {
    const draftFolder = path.join(vault, ".quality-kb", "drafts", item.id);
    // Check the parent chain before listing it.
    assertVaultPath(vault, `.quality-kb/drafts/${item.id}`);
    item.drafts = existsSync(draftFolder) ? readdirSync(draftFolder).sort().map((file) => {
      if (!/^[a-f0-9]{24}\.json$/.test(file)) throw new Error(`草稿檔名無效 ${file}`);
      const raw = readLocal(vault, `.quality-kb/drafts/${item.id}/${file}`);
      const draft = parseDraft(raw);
      if (draftKey(draft) !== file.slice(0, -5)) throw new Error(`草稿指紋不符 ${file}`);
      return { file, draft };
    }) : [];
    item.reviewPath = `複核/${item.id}-review.md`;
    item.reviewRaw = reviewOverrides.get(item.id) ?? readLocal(vault, item.reviewPath);
    item.review = readReview(item.reviewRaw, item.errors);
    item.controlRaw = readLocal(vault, controlPath(item.id));
    item.control = item.controlRaw === null ? { ...emptyControl } : parseControl(JSON.parse(item.controlRaw));
  }
  for (const item of items) {
    const review = item.review;
    if (!["pending", "reviewed", "closed"].includes(review.review_status)) item.errors.push("review_status 值無效");
    if (review.defect && !terms.some((term) => term.id === review.defect)) item.errors.push("defect 未在詞彙表");
    if (review.duplicate_of) {
      const target = byId.get(review.duplicate_of);
      if (!target?.available || target === item || target.review.duplicate_of) item.errors.push("duplicate_of 必須指向可用的主案");
    }
    if (["reviewed", "closed"].includes(review.review_status)) {
      if (!review.defect || !data.files.has(review.evidence_path) || !nonempty(review.evidence_locator) || !nonempty(review.finding)) {
        item.errors.push("複核需有效缺陷、存在的證據檔、定位與判定");
      }
    }
    if (review.review_status === "closed") {
      if (!data.files.has(review.verification_path) || !nonempty(review.verification_locator) || !nonempty(review.verification_result)) {
        item.errors.push("結案需存在的確效證據檔、定位與結果");
      }
    }
    item.certified = item.available && item.errors.length === 0 && !review.duplicate_of && ["reviewed", "closed"].includes(review.review_status);
  }
  return { ...data, items, terms, registry, aliases };
}

function readReview(raw, errors) {
  if (raw === null) return { review_status: "pending" };
  try {
    const frontmatter = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
    return mapping(yaml.load(frontmatter?.[1] ?? "", { schema: yaml.JSON_SCHEMA }), "複核屬性");
  } catch (error) {
    errors.push(`無法讀取複核屬性 ${error.message}`);
    return { review_status: "pending" };
  }
}

function nonempty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function assertVaultPath(vault, file) {
  let full = vault;
  for (const part of file.split("/")) {
    full = path.join(full, part);
    try {
      if (lstatSync(full).isSymbolicLink()) throw new Error(`不支援符號連結 ${file}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return full;
}

export function parseDraft(raw) {
  if (typeof raw !== "string" || Buffer.byteLength(raw, "utf8") > 2_000_000) throw new Error("8D 草稿不得超過 2 MB");
  const data = JSON.parse(raw.replace(/^\uFEFF/, ""));
  if (data?.format !== "8d-creator.quality-kb" || data.version !== 1 || !nonempty(data.markdown)
    || typeof data.fields !== "object" || data.fields === null) {
    throw new Error("無法辨識 8D Creator 草稿");
  }
  const fields = {};
  for (const key of ["date", "product", "batch", "customer", "defectQuantity", "problem"]) {
    if (typeof data.fields[key] !== "string") throw new Error(`8D 欄位 ${key} 需為字串`);
    fields[key] = data.fields[key];
  }
  return { format: data.format, version: data.version, fields, markdown: data.markdown };
}

export function draftKey(draft) {
  return digest(JSON.stringify(draft)).slice(0, 24);
}
