// Bewaart het platform op de gsm zodat het snel opent. Gegevens komen altijd eerst online.
const CACHE = "ogv-platform-v54";
const SHELL = ["./", "index.html", "app/app.css?v=54", "app/core.js?v=54", "app/ploeg.js?v=54", "app/cijfers.js?v=54", "app/wedstrijd.js?v=54", "app/leerplan.js?v=54", "app/teken.js?v=54", "app/training.js?v=54", "app/video.js?v=54", "app/map.js?v=54", "app/rbfa.js?v=54", "app/club.js?v=54", "app/evaluatie.js?v=54", "app/kennis.js?v=54", "pitch.js?v=54",
  "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png", "icons/favicon.png", "icons/icon-512.png", "tactiekbord/vendor/supabase-2.118.0.js",
  "trainingen/trainingen.json", "matchday/", "tactiekbord/"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (/\.(mp4|pdf|docx|pptx)$/i.test(url.pathname)) return; // grote bestanden niet in de cache
  /* pagina's (ook het wedstrijdblad en animatiebord) altijd opnieuw controleren bij de server, nooit een oude versie uit de browsercache */
  const html = e.request.mode === "navigate" || e.request.destination === "document" || e.request.destination === "iframe" || /\/$|\.html$/.test(url.pathname);
  e.respondWith(fetch(e.request, html ? { cache: "no-cache" } : undefined).then(r => { const copy = r.clone(); if (r.ok) caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
