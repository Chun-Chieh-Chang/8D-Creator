import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const base = "/8D-Creator/";
const localOrigin = "http://127.0.0.1:3188";
const pagesOrigin = "https://8d-pages.test";
const output = fileURLToPath(new URL("../out/", import.meta.url));
const serverScript = fileURLToPath(new URL("./quality-kb/local.mjs", import.meta.url));
const requiredNodes = [
  "同步既有案件", "新增案件", "判定 NCA 狀態", "僅供參考", "執行 5-Why",
  "複核 8D 草稿", "儲存至案件", "匯出 8D 報告", "匯入 8D 草稿", "Obsidian 知識庫",
];
const requiredShortcuts = [
  "新增案件", "搜尋案件", "複核與列管 NCA", "從案件製作 8D 報告", "查閱經驗筆記", "直接開啟 8D 報告",
];

async function snapshot(page) {
  const graph = page.getByRole("group", { name: "8D Creator 資料流程", exact: true });
  for (const name of requiredNodes) {
    await graph.getByRole("button", { name, exact: true }).waitFor();
  }
  const diagram = await graph.evaluate((svg) => ({
    viewBox: svg.getAttribute("viewBox"),
    nodes: [...svg.querySelectorAll("[data-flow-node]")].map((node) => node.getAttribute("aria-label")),
    edges: [...svg.querySelectorAll("path[marker-end]")].map((edge) => edge.getAttribute("d")),
  }));
  assert.ok(diagram.edges.length >= requiredNodes.length, "The map must show its workflow connections.");
  const shortcuts = page.getByRole("region", { name: "快速入口", exact: true }).getByRole("button");
  const labels = (await shortcuts.allTextContents()).map((label) => label.trim());
  for (const label of requiredShortcuts) {
    assert.ok(labels.some((text) => text.startsWith(label)), `Missing shortcut: ${label}`);
  }
  return { ...diagram, shortcuts: labels };
}

test("Check the published project map before deployment", { timeout: 60_000 }, async (t) => {
  const tempRoot = path.resolve(os.tmpdir());
  const fixture = await mkdtemp(path.join(tempRoot, "8d-project-map-"));
  assert.equal(path.dirname(fixture), tempRoot);
  const source = path.join(fixture, "source");
  const vault = path.join(fixture, "vault");
  let browser;
  let server;
  let closed;

  const stopServer = async () => {
    if (!server) return;
    server.kill();
    await closed;
    server = undefined;
  };
  t.after(async () => {
    try {
      await browser?.close();
    } finally {
      await stopServer();
      await rm(fixture, { recursive: true, force: true });
    }
  });

  await Promise.all([mkdir(source), mkdir(vault)]);
  server = spawn(process.execPath, [serverScript, "--source", source, "--vault", vault], {
    env: { ...process.env, EIGHTD_AGENT: "off" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  closed = new Promise((resolve) => server.once("close", resolve));
  let timer;
  await new Promise((resolve, reject) => {
    let log = "";
    timer = setTimeout(() => reject(new Error("The test workspace did not start. " + log)), 10_000);
    server.once("error", reject);
    server.stderr.on("data", (chunk) => { log += chunk; });
    server.stdout.on("data", (chunk) => {
      log += chunk;
      if (log.includes(localOrigin + base)) resolve();
    });
    void closed.then((code) => reject(new Error(`The test workspace stopped (${code}). ${log}`)));
  }).finally(() => clearTimeout(timer));

  browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: "block" });
  context.setDefaultTimeout(8_000);
  await context.route(localOrigin + base + "api/kb/model-check", (route) => route.fulfill({
    json: { providers: [], checkedAt: "2026-01-01T00:00:00Z" },
  }));
  await context.route(pagesOrigin + "/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (!pathname.startsWith(base) || pathname.startsWith(base + "api/")) {
      await route.fulfill({ status: 404 });
      return;
    }
    const file = pathname.slice(base.length) || "index.html";
    await route.fulfill({ path: path.join(output, file) });
  });

  const local = await context.newPage();
  const pages = await context.newPage();
  await Promise.all([
    local.goto(localOrigin + base + "#map", { waitUntil: "domcontentloaded" }),
    pages.goto(pagesOrigin + base + "#map", { waitUntil: "domcontentloaded" }),
  ]);
  await local.getByRole("button", { name: "關閉伺服器", exact: true }).waitFor();
  const localMap = await snapshot(local);
  assert.deepEqual(await snapshot(pages), localMap, "Pages and the local workspace must show the same map.");
  assert.equal(await pages.getByRole("button", { name: "關閉伺服器", exact: true }).count(), 0);

  await pages.getByRole("button", { name: "8D 報告", exact: true }).click();
  await pages.getByRole("button", { name: "開始分析", exact: true }).waitFor();
  assert.equal(new URL(pages.url()).origin, pagesOrigin, "The report must open on Pages.");
  await pages.getByRole("button", { name: "專案地圖", exact: true }).click();
  const graph = pages.getByRole("group", { name: "8D Creator 資料流程", exact: true });
  await graph.getByRole("button", { name: "新增案件", exact: true }).click();
  await Promise.all([
    pages.waitForRequest((request) => request.url() === localOrigin + base + "?caseTask=new"),
    pages.getByRole("button", { name: "在本機新增案件", exact: true }).click(),
  ]);
  await pages.getByRole("heading", { name: "新增案件", exact: true }).waitFor();
  assert.equal(new URL(pages.url()).origin, localOrigin, "The new case form must open in the local workspace.");

  await stopServer();
  await pages.goto(pagesOrigin + base + "#map", { waitUntil: "domcontentloaded" });
  await pages.getByText("案件操作會開啟本機工作區。", { exact: false }).waitFor();
  assert.deepEqual(await snapshot(pages), localMap, "Pages must show the full map while the local workspace is offline.");
});
