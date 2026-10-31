// sw.js – Offline-Versicherung für den KalorienZähler.
const CACHE = "kalorienzaehler-v1"; // bei künftigen Änderungen hochzählen, z. B. -v2
const ASSETS = ["./", "./index.html", "./db.js", "./app.js", "./manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // z. B. spätere API-Requests direkt durchreichen

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    })).catch(() => (event.request.mode === "navigate" ? caches.match("./index.html") : new Response("Offline", { status: 503, statusText: "Offline" })))
  );
});
