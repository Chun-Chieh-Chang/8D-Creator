import path from "node:path";
import { pathToFileURL } from "node:url";
import yaml from "js-yaml";
import { categories } from "./model.mjs";

export const marker = "<!-- quality-kb:generated -->";
const note = (folder, name) => `[[${folder}/${name}]]`;
const linkCase = (id) => note("案件", id);
const linkTerm = (term) => note("缺陷", term.id);
const safe = (value) => String(value).replace(/[\r\n]+/g, " ").replace(/[\\[\]*_`<>|!#~]/g, "\\$&");
const linkSource = (root, file, label) => `[${safe(label)}](${pathToFileURL(path.join(root, file)).href.replaceAll("(", "%28").replaceAll(")", "%29")})`;
const entry = (item) => `- ${linkCase(item.id)} ${item.day} · ${categories[item.category]} · ${safe(item.title)}`;
const bullets = (lines) => lines.length ? lines.join("\n") : "無。";
const page = (title, body) => `${marker}\n# ${title}\n\n${body}\n`;
const properties = (fields) => `---\n${yaml.dump(fields, { lineWidth: -1 })}---\n`;
const draftNote = (id, key) => `${id}-${key}`;

export function reviewTemplate(item) {
  return properties({
    review_status: "pending",
    defect: null,
    evidence_path: null,
    evidence_locator: null,
    finding: null,
    verification_path: null,
    verification_locator: null,
    verification_result: null,
    duplicate_of: null,
  }) + `\n# 複核 ${item.id}\n\n${linkCase(item.id)} · [[首頁#複核方式|複核方式]]\n\n## 問題與影響範圍\n\n## 圍堵與矯正\n\n## 發生原因與流出原因\n\n## 措施確效與復發追蹤\n\n## 可重用經驗與適用條件\n`;
}

function fenced(markdown) {
  let length = 3;
  for (const match of markdown.matchAll(/~+/g)) length = Math.max(length, match[0].length + 1);
  const fence = "~".repeat(length);
  return `${fence}\n${markdown.trimEnd()}\n${fence}`;
}

function addTo(groups, key, item) {
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(item);
}

export function render(root, state) {
  const generated = new Map();
  const active = state.items.filter((item) => item.available);
  const pending = active.filter((item) => !item.certified && !item.review.duplicate_of);
  const refs = new Map();
  const products = new Map();
  for (const item of active) {
    for (const id of item.ids) addTo(refs, id, item);
    for (const product of item.products) addTo(products, product, item);
  }

  generated.set("首頁.md", page("個人異常管理知識庫", [
    `已索引 **${active.length}** 筆來源記錄，覆蓋 **${state.files.size}** 個檔案的路徑。已複核主案 **${active.filter((item) => item.certified).length}** 筆，待複核 **${pending.length}** 筆。`,
    "- [[案件總覽]] · [[缺陷總覽]] · [[品號線索]]",
    "- [[待處理]] · [[8D 草稿總覽]]",
    "## 複核方式",
    "打開案件下的複核筆記。從來源連結查證後，在屬性填入詞彙 ID、相對證據路徑、頁碼／列號／圖號和判定。將狀態設為 reviewed。結案另填確效證據與實測結果，再設為 closed。",
    "若手上已有草稿 JSON，請在案件的「8D 草稿」選取「匯入 8D 草稿」。也可從專案執行 \`npm run kb -- attach <案件ID> <JSON路徑>\`。更新來源或複核屬性後，執行 \`npm run kb -- sync\`。證據路徑使用 /。可從案件附件清單複製相對路徑。",
    "先從重複編號、同品號及缺陷線索找舊案。涉及生產條件、原因或對策效力時，回到複核與原始證據。"
  ].join("\n\n")));
  generated.set("案件總覽.md", page("案件總覽", Object.entries(categories).map(([key, label]) => {
    const cases = active.filter((item) => item.category === key);
    return `## ${label}（${cases.length} 筆來源記錄）\n\n${bullets(cases.map(entry))}`;
  }).join("\n\n")));

  const collisions = [...refs].filter(([, cases]) => cases.filter((item) => !item.review.duplicate_of || item.errors.length).length > 1);
  generated.set("待處理.md", page("待處理", [
    `## 複核屬性有誤（${state.items.filter((item) => item.errors.length).length}）\n\n${bullets(state.items.filter((item) => item.errors.length).map((item) => `- ${linkCase(item.id)} ${safe(item.errors.join("；"))}`))}`,
    `## 來源失聯\n\n${bullets(state.items.filter((item) => !item.available).map(entry))}`,
    `## 同編號待比對（${collisions.length} 組）\n\n${bullets(collisions.map(([id, cases]) => `- ${safe(id)} · ${cases.map((item) => linkCase(item.id)).join("、")}`))}`,
    `## 未歸檔來源及解析缺口\n\n${bullets([
      ...state.issues.map((issue) => `- ${safe(issue)}`),
      ...state.skipped.map((file) => `- 跳過連結或特殊檔案 ${safe(file)}`),
      ...state.unmapped.map((file) => `- ${linkSource(root, file, file)}`),
      ...active.filter((item) => !item.files.length).map((item) => `- ${linkCase(item.id)} 無附件`),
    ])}`,
    `## 待複核（${pending.length} 筆）\n\n${bullets(pending.map(entry))}`,
  ].join("\n\n")));

  for (const item of state.items) {
    const relations = item.ids.flatMap((id) => (refs.get(id) ?? []).filter((other) => other !== item));
    const evidence = (file, locator) => state.files.has(file) && typeof locator === "string"
      ? `${linkSource(root, file, file)} · ${safe(locator)}` : "待補";
    const notes = item.drafts.map(({ file, draft }) => {
      const name = draftNote(item.id, file.slice(0, -5));
      generated.set(`8D 草稿/${name}.md`, page("8D 草稿", [
        `案件 ${linkCase(item.id)}`,
        "此快照來自 8D Creator。複核時查證原始證據。",
        ...Object.entries(draft.fields).map(([key, value]) => `- ${safe(key)} · ${safe(value)}`),
        fenced(draft.markdown),
      ].join("\n\n")));
      return `- ${note("8D 草稿", name)}`;
    });
    const concepts = item.concepts.map((term) => `${linkTerm(term)} ${safe(term.label)}`);
    const confirmed = state.terms.find((term) => term.id === item.review.defect);
    const status = !item.available ? "missing" : item.errors.length ? "invalid" : item.review.duplicate_of ? "duplicate" : item.review.review_status;
    generated.set(`案件/${item.id}.md`, properties({
      case_id: item.id, source_category: item.category, source_date: item.day, kb_status: status,
      product_hints: item.products, defect_hints: item.concepts.map((term) => term.id),
      confirmed_defect: item.certified ? confirmed.id : null,
    }) + page(safe(item.title), [
      `${item.id} · ${categories[item.category]} · ${item.day} · ${status}`,
      `複核筆記 ${note("複核", `${item.id}-review`)}`,
      item.available ? `來源 ${linkSource(root, item.source, item.source)}${item.locator ? ` · ${safe(item.locator)}` : ""}` : `來源失聯 ${safe(item.source)}`,
      item.closedInSource ? `來源表所載結案日期 ${item.closedInSource}` : "",
      `## 檢索線索\n\n- 參考編號 ${item.ids.join("、") || "待補"}\n- 品號 ${item.products.join("、") || "待補"}\n- 缺陷 ${concepts.join("、") || "待補"}\n- 同編號候選 ${[...new Set(relations)].map((other) => linkCase(other.id)).join("、") || "無"}`,
      `## 複核結果\n\n${bullets([
        ...(item.review.duplicate_of && !item.errors.length ? [`- 合併至 ${linkCase(item.review.duplicate_of)}`] : []),
        ...item.errors.map((message) => `- ${safe(message)}`),
        ...(item.certified ? [
          `- 缺陷 ${linkTerm(confirmed)} ${safe(confirmed.label)}`,
          `- 判定 ${safe(item.review.finding)}`,
          `- 證據 ${evidence(item.review.evidence_path, item.review.evidence_locator)}`,
          ...(status === "closed" ? [`- 確效 ${safe(item.review.verification_result)} · ${evidence(item.review.verification_path, item.review.verification_locator)}`] : []),
        ] : []),
      ])}`,
      `## 8D 草稿\n\n${bullets(notes)}`,
      `## 來源附件（${item.files.length}）\n\n${bullets(item.files.map((file) => item.available ? `- ${linkSource(root, file, file)}` : `- ${safe(file)}`))}`,
    ].filter(Boolean).join("\n\n")));
  }

  generated.set("8D 草稿總覽.md", page("8D 草稿總覽",
    bullets(state.items.filter((item) => item.drafts.length).map((item) => `${entry(item)} · ${item.drafts.length} 份草稿`))));
  generated.set("品號線索.md", page("品號線索", [...products].sort(([a], [b]) => a.localeCompare(b)).map(([product, items]) =>
    `## ${product}\n\n${bullets(items.map(entry))}`).join("\n\n")));
  generated.set("缺陷總覽.md", page("缺陷總覽", bullets(state.terms.map((term) =>
    `- ${linkTerm(term)} ${safe(term.label)} · ${safe(term.definition)}`))));
  for (const term of state.terms) {
    const verified = active.filter((item) => item.certified && item.review.defect === term.id);
    const candidates = active.filter((item) => !item.certified && !item.review.duplicate_of && item.concepts.includes(term));
    generated.set(`缺陷/${term.id}.md`, page(safe(term.label), [
      safe(term.definition),
      `詞彙 ID ${term.id}。線索用語 ${term.aliases.map(safe).join("、")}。`,
      `## 已複核（${verified.length}）\n\n${bullets(verified.map(entry))}`,
      `## 標題或摘要線索（${candidates.length}）\n\n${bullets(candidates.map(entry))}`,
    ].join("\n\n")));
  }
  return generated;
}
