// ChantierPro — Service Worker minimaliste
// Stratégie :
// - Installation : skipWaiting → activation immédiate
// - Activation : claim tous les clients + cleanup vieux caches
// - Fetch :
//    • requêtes API (/api/*, supabase.co, anthropic) → network-only,
//      pas de cache (données live)
//    • assets statiques (.js, .css, .svg, .png) → cache-first avec
//      fallback réseau, met à jour le cache en background
//    • navigation (HTML) → network-first avec fallback cache
//      (utile en mode offline)
const CACHE_VERSION = "cp-v2";
const ASSETS_CACHE = `${CACHE_VERSION}-assets`;
const SHELL_CACHE  = `${CACHE_VERSION}-shell`;

// URLs essentielles à pré-cacher dès l'install
const SHELL_URLS = ["/", "/index.html", "/manifest.json", "/icon.svg", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.host.includes("supabase.co") ||
    url.host.includes("anthropic.com") ||
    url.host.includes("qonto.com")
  );
}

function isAsset(url) {
  return /\.(js|css|svg|png|jpg|jpeg|webp|woff2?|ttf|ico)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 1) Requêtes API : jamais cache
  if (isApiRequest(url)) return; // laisse le navigateur gérer

  // 2) Assets statiques : cache-first + revalidation background
  if (isAsset(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchAndCache = fetch(req).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(ASSETS_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || fetchAndCache;
      })
    );
    return;
  }

  // 3) Navigation HTML : network-first, fallback cache shell
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(SHELL_CACHE).then((c) => c.put("/", clone));
        return res;
      }).catch(() => caches.match("/").then((r) => r || caches.match("/index.html")))
    );
    return;
  }
});
