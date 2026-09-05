// Buddy Reminder service worker — precaches the app shell so the app
// itself opens offline after the first successful load, independent of
// whether any data can reach the network.

const CACHE_VERSION = "buddy-v18";

// Google Fonts. Cached on first online load so the typography survives
// offline; if they're never fetched, the CSS falls back to system faces.
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

const SHELL_FILES = [
  "./",
  "index.html",
  "manifest.json",
  "css/app.css",
  "js/app.js",
  "js/db.js",
  "js/insights.js",
  "js/voice.js",
  "js/parse.js",
  "js/notify.js",
  "js/sync.js",
  "js/calendar.js",
  "icons/icon-192.png",
  "icons/icon-192-maskable.png",
  "icons/icon-512.png",
  "icons/icon-512-maskable.png",
  "icons/icon-180.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_FILES.map((f) => new Request(f, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first, cache-fallback. Online you always get the current file, so a
// change is live on the next refresh — no stale copy to chase. Offline the
// cache answers instead, which is what keeps the app usable in airplane mode.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    // Font files never change under a given URL, so cache-first is right here.
    if (!FONT_HOSTS.includes(url.hostname)) return; // e.g. Firestore — straight to the network
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request)
            .then((response) => {
              const copy = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
              return response;
            })
            .catch(() => new Response("", { status: 504, statusText: "Offline" }))
      )
    );
    return;
  }

  event.respondWith(
    // `cache: "reload"` skips the browser's own HTTP cache. Without it a
    // heuristically-fresh copy can be served for a file that changed on the
    // server, which is exactly the "why am I still seeing the old version"
    // trap this strategy exists to avoid.
    fetch(event.request, { cache: "reload" })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === "navigate") return caches.match("index.html");
          return new Response("", { status: 504, statusText: "Offline" });
        })
      )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./index.html");
    })
  );
});
