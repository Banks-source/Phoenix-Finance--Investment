// Minimal service worker: makes the app installable and keeps the shell
// available offline. Financial data is never served stale from cache —
// /api and page requests always go to the network first, and the cache is
// only a fallback when the device is genuinely offline.
const CACHE = "phoenix-v1";
const SHELL = ["/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cache API responses

  event.respondWith(
    fetch(request)
      .then((res) => {
        // Only static assets are worth keeping; pages change per request.
        if (res.ok && /\.(png|svg|ico|css|js|json|woff2?)$/.test(url.pathname)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit ?? caches.match("/")))
  );
});
