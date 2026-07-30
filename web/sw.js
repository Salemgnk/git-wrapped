// Service worker Git Wrapped — cache du shell (offline / installable).
// Bump CACHE à chaque changement d'assets pour invalider l'ancien cache.
const CACHE = "gw-v16";
const ASSETS = [
  "/", "/wrapped.js", "/wrapped.css", "/fonts.css",
  "/fonts/SpaceGrotesk-500.woff2", "/fonts/SpaceGrotesk-700.woff2",
  "/fonts/SpaceMono-700.woff2",
  "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  // L'API a besoin du réseau : network-first, sans mise en cache.
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // Shell statique : cache-first, avec rafraîchissement en arrière-plan.
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
    if (resp && resp.status === 200 && resp.type === "basic") {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
    }
    return resp;
  }).catch(() => caches.match("/"))));
});
