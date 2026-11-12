import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const terms = [
  ["生成報告", "產生報告"],
  ["報告生成", "產生報告"],
  ["不良數量", "不良品數量"],
  ["缺陷現象詳細描述", "缺陷描述"],
  ["初步原因猜測", "可能原因"],
  ["AI 引擎設定", "AI 設定"],
  ["AI 模型引擎設定", "AI 設定"],
  ["新建報告", "新增報告"],
  ["輸出報告", "匯出報告"],
  ["下載 PDF", "匯出 PDF"],
  ["下載知識庫草稿", "匯出知識庫草稿"],
  ["用戶", "使用者"],
  ["質量管理", "品質管理"],
  ["相似歷史案例", "相似案件"],
  ["相關歷史案例", "相似案件"],
];

function filesUnder(directory) {
  return readdirSync(path.join(root, directory), { withFileTypes: true })
    .flatMap((entry) => {
      const file = path.posix.join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(file) : [file];
    });
}

const files = [
  "README.md", "walkthrough.md",
  ...filesUnder("docs").filter((file) => file.endsWith(".md")),
  ...filesUnder("src").filter((file) => /\.tsx?$/.test(file)),
  ...filesUnder("scripts/quality-kb").filter((file) => file.endsWith(".mjs") && !file.endsWith(".test.mjs")),
];

let findings = 0;
for (const file of files.sort()) {
  const lines = readFileSync(path.join(root, file), "utf8").split(/\r?\n/);
  let fence;
  for (const [index, line] of lines.entries()) {
    const marker = file.endsWith(".md") && /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
      continue;
    }
    if (fence) continue;
    for (const [oldTerm, preferred] of terms) {
      if (!line.includes(oldTerm)) continue;
      console.error(file + ":" + (index + 1) + " 使用「" + preferred + "」取代「" + oldTerm + "」。");
      findings++;
    }
  }
}

if (findings) process.exitCode = 1;
else console.log("術語檢查通過（" + files.length + " 個檔案）。");
