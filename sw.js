/* ==========================================================================
   AURA — Offline & Low-Speed Cache Service Worker
   Cache-first frames & icons for instant playback on unstable/slow networks,
   network-first (with cache fallback) for HTML/CSS/JS shell assets.
   ========================================================================== */

const CACHE_NAME = "aura-cache-v25";

const CORE_SHELL = [
  "./",
  "./index.html",
  "./css/style.css?v=25",
  "./frames/manifest.js?v=25",
  "./js/poster.js?v=25",
  "./js/config.js?v=25",
  "./js/main.js?v=25",
  "./assets/icons/clipper.svg",
  "./assets/icons/hyperdrain.png",
  "./assets/icons/pulsar-audio.png",
  "./assets/icons/pulserelease.png",
  "./assets/icons/estateradar.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(CORE_SHELL.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("aura-cache-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Cache-first for same-origin video frames and static app icons
  if (
    url.origin === self.location.origin &&
    (url.pathname.includes("/frames/") ||
     url.pathname.includes("/frames-m/") ||
     url.pathname.includes("/assets/"))
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          if (cached) return cached;
          return fetch(req).then((networkRes) => {
            if (networkRes && networkRes.ok) {
              cache.put(req, networkRes.clone()).catch(() => {});
            }
            return networkRes;
          });
        })
      )
    );
    return;
  }

  // Network-first with timeout + cache fallback for app shell (HTML/CSS/JS)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);

        return fetch(req, { signal: controller.signal })
          .then((networkRes) => {
            clearTimeout(timer);
            if (networkRes && networkRes.ok) {
              cache.put(req, networkRes.clone()).catch(() => {});
            }
            return networkRes;
          })
          .catch(() => {
            clearTimeout(timer);
            return cache.match(req).then((cached) => {
              if (cached) return cached;
              if (req.mode === "navigate") {
                return cache.match("./index.html");
              }
              return Response.error();
            });
          });
      })
    );
    return;
  }

  // External Google Fonts: stale/cache-first fallback cleanly when offline
  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          const fetchPromise = fetch(req)
            .then((networkRes) => {
              if (networkRes && networkRes.ok) {
                cache.put(req, networkRes.clone()).catch(() => {});
              }
              return networkRes;
            })
            .catch(() => cached || Response.error());
          return cached || fetchPromise;
        })
      )
    );
  }
});
