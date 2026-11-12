const sources = {
  agnes: "https://wiki.agnes-ai.com/en/docs/pricing.md",
  gemini: "https://aistudio.google.com/docs/pricing.md",
};

function agnesFree(text) {
  const section = /^### Current offers\s*\n([\s\S]*?)(?=^#{2,3}\s|\s*$)/m.exec(text)?.[1];
  const models = new Set();
  for (const line of section?.split("\n") ?? []) {
    if (!/input tokens.*output tokens.*(?:currently free for|free for)/i.test(line)) continue;
    for (const [, id] of line.matchAll(/`(agnes-\d+(?:\.\d+)+-(?:flash|pro)(?:-[a-z0-9]+)?)`/gi)) models.add(id);
  }
  return [...models];
}

function geminiFree(text) {
  const models = new Set();
  for (const section of text.split(/^## /m).slice(1)) {
    const id = section.split("\n", 1)[0].match(/id="(gemini-\d+(?:\.\d+)?-(?:flash(?:-lite)?|pro)(?:-preview(?:-\d{2}-\d{2})?)?)"/)?.[1];
    if (!id || !section.includes("`" + id + "`")
      || /(?:deprecated|no longer available)/i.test(section.slice(0, section.indexOf('{% tab title="Standard" %')))) continue;
    const pricing = section.split('{% tab title="Standard" %}')[1]?.split("{% /tab %}")[0];
    if (!pricing) continue;
    const freeInput = /^\s*\* Input price\s*\n\s*\* Free of charge(?:\s|$)/mi.test(pricing);
    const freeOutput = /^\s*\* Output price[^\n]*\n\s*\* Free of charge(?:\s|$)/mi.test(pricing);
    if (freeInput && freeOutput) models.add(id);
  }
  return [...models];
}

export function createModelCatalog(fetchPricing = fetch) {
  let nextCheck = 0;
  let cached;
  let pending;
  async function read(provider, parse) {
    const source = sources[provider];
    try {
      const response = await fetchPricing(source, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("定價頁無法讀取。");
      const text = await response.text();
      const models = parse(text);
      return { provider, source: source.replace(/\.md$/, ""), models: models.length ? models : null };
    } catch {
      return { provider, source: source.replace(/\.md$/, ""), models: null };
    }
  }
  return async function check() {
    if (cached && Date.now() < nextCheck) return cached;
    pending ??= Promise.all([read("agnes", agnesFree), read("gemini", geminiFree)]).then((providers) => {
      cached = { providers, checkedAt: new Date().toISOString() };
      nextCheck = Date.now() + (providers.every((entry) => entry.models) ? 6 * 60 * 60_000 : 10 * 60_000);
      pending = undefined;
      return cached;
    });
    return pending;
  };
}
