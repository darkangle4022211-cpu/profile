/* Service worker retired (v32): clear legacy caches and self-unregister so
   native HTTP disk cache serves immutable frames directly without SW overhead. */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .catch(() => {})
  );
});
