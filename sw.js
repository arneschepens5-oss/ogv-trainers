// Bewaart het platform op de gsm zodat het snel opent. Gegevens komen altijd eerst online.
const CACHE = "ogv-platform-v18";
const SHELL = ["./", "index.html", "app/app.css?v=18", "app/core.js?v=18", "app/ploeg.js?v=18", "app/wedstrijd.js?v=18", "app/leerplan.js?v=18", "app/training.js?v=18", "app/video.js?v=18", "app/map.js?v=18", "app/rbfa.js?v=18", "app/club.js?v=18", "app/evaluatie.js?v=18", "app/kennis.js?v=18", "pitch.js?v=18",
  "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png", "icons/favicon.png", "icons/icon-512.png", "tactiekbord/vendor/supabase-2.118.0.js",
  "trainingen/trainingen.json", "matchday/", "tactiekbord/"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (/\.(mp4|pdf|docx|pptx)$/i.test(url.pathname)) return; // grote bestanden niet in de cache
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); if (r.ok) caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
