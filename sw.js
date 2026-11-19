// Cache offline. Il nome cambia a ogni versione (APP_VERSION in js/version.js, copiata da pages.yml).
const VERSION = "dev";
const CACHE = "kapibo-" + VERSION, MODS = "kapibo-moduli";
const CORE = ["./", "index.html", "css/style.css", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png",
  "js/app.js", "js/i18n.js", "js/store.js", "js/categories.js", "js/money.js", "js/mascot.js", "js/stats.js", "js/charts.js", "js/version.js", "js/ai.js",
  "js/sync/index.js", "js/sync/dropbox.js", "js/sync/gdrive.js", "locales/en.json"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {})));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("kapibo-") && k !== CACHE && k !== MODS).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("message", e => { if (e.data === "skip") self.skipWaiting(); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // motore OCR/PDF (stesso dominio o CDN), font, vendor: "cache prima", restano tra le versioni
  const heavy = /\/pdf-tiny-tools\/vendor\/|cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com|\/vendor\//.test(u.href);
  if (heavy) { e.respondWith(caches.open(MODS).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok || r.type === "opaque") c.put(e.request, r.clone()); return r; }))); return; }
  if (u.origin !== location.origin) return;
  // app: rete prima (aggiornamenti subito), cache se offline
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
