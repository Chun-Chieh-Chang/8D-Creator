export function caseNoteName(item, id) {
  // Keep enough room for the vault path and a draft version on Windows.
  const title = item.title.normalize("NFC")
    .replace(/[<>:"/\\|?*#^\[\]%\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ").trim();
  const shortTitle = Array.from(title).slice(0, 48).join("").replace(/[. ]+$/, "");
  return `${item.day} ${shortTitle || "案件"} · ${id.slice(3, 13)}`;
}

export const caseNotePath = (item) => `案件/${item.noteName}.md`;
export const reviewNotePath = (item) => `複核/複核 ${item.noteName}.md`;
export const draftNotePath = (item, file) => `8D 草稿/8D 草稿 ${item.noteName} · ${file.slice(0, -5)}.md`;

export function noteMigrations(items) {
  const paths = new Map();
  for (const item of items) {
    paths.set(`案件/${item.id}.md`, caseNotePath(item));
    paths.set(`複核/${item.id}-review.md`, reviewNotePath(item));
    for (const { file } of item.drafts) {
      paths.set(`8D 草稿/${item.id}-${file.slice(0, -5)}.md`, draftNotePath(item, file));
    }
  }
  return paths;
}
