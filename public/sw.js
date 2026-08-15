/**
 * 8D-Creator Service Worker (PWA)
 * 策略：
 * - install: 預快取 App Shell + 自我發現預快取（解析 index.html 內所有同源資源：
 *   _next/static chunks、CSS、字型、icons）→ 首次造訪即具完整離線能力
 * - navigate: 網路優先 → 失敗回退快取（確保部署更新可見，離線仍可用）
 * - 靜態資源: stale-while-revalidate（_next/static 內容 hash 不可變，快取安全）
 * - activate: 清除舊版快取 + clients.claim
 */
const CACHE_NAME = "8d-creator-v2";
// 相對 SW script 所在位置（GitHub Pages basePath 相容）
const SHELL_URL = "./";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. 快取 App Shell
      const shellResponse = await fetch(SHELL_URL, { cache: "no-cache" });
      await cache.put(SHELL_URL, shellResponse.clone());

      // 2. 自我發現：解析 index.html 內所有同源資源並預快取
      const html = await shellResponse.text();
      const assetUrls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((match) => match[1])
        .filter((url) => url && !url.startsWith("data:") && !url.startsWith("#"))
        .map((url) => new URL(url, self.location.href))
        .filter((url) => url.origin === self.location.origin)
        .map((url) => url.href);

      // 3. 明確預快取 PWA 資產（manifest 與圖示不在 index.html 中）
      assetUrls.push(
        new URL("./manifest.webmanifest", self.location.href).href,
        new URL("./icons/icon-192.png", self.location.href).href,
        new URL("./icons/icon-512.png", self.location.href).href,
        new URL("./icons/icon-maskable-512.png", self.location.href).href,
        new URL("./icons/apple-touch-icon.png", self.location.href).href
      );

      await Promise.allSettled(assetUrls.map((url) => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 導航請求：網路優先，失敗回退快取，成功時更新快取
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(SHELL_URL, copy));
          return response;
        })
        .catch(() => caches.match(SHELL_URL))
    );
    return;
  }

  // 靜態資源：stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});