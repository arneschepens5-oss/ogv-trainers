// Bewaart het platform op de gsm zodat het snel opent. Gegevens komen altijd eerst online.
const CACHE = "ogv-platform-v104";
const SHELL = ["./", "index.html", "app/app.css?v=104", "app/core.js?v=104", "app/ploeg.js?v=104", "app/cijfers.js?v=104", "app/wedstrijd.js?v=104", "app/leerplan.js?v=104", "app/teken.js?v=104", "app/training.js?v=104", "app/video.js?v=104", "app/map.js?v=104", "app/rbfa.js?v=104", "app/club.js?v=104", "app/evaluatie.js?v=104", "app/evvragen.js?v=104", "app/dossier.js?v=104", "app/trainers.js?v=104", "app/groei.js?v=104", "app/scoutint.js?v=104", "app/kennis.js?v=104", "app/ouders.js?v=104", "app/vendor/xlsx-0.18.5.mini.min.js", "pitch.js?v=104",
  "manifest.webmanifest", "manifest-beheer.webmanifest", "icons/beheer-192.png", "icons/beheer-apple-touch-icon.png", "icons/icon-192.png", "icons/logo.png", "icons/logo-dark.png", "icons/apple-touch-icon.png", "icons/favicon.png", "icons/icon-512.png", "tactiekbord/vendor/supabase-2.118.0.js",
  "trainingen/trainingen.json", "matchday/", "tactiekbord/"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("ogv-platform-") && k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (/\.(mp4|pdf|docx|pptx|onnx|wasm)$/i.test(url.pathname)) return; // grote bestanden (ook het herkenningsmodel) niet in deze cache: de browser bewaart ze zelf
  /* pagina's (ook het wedstrijdblad en animatiebord) altijd opnieuw controleren bij de server, nooit een oude versie uit de browsercache */
  const html = e.request.mode === "navigate" || e.request.destination === "document" || e.request.destination === "iframe" || /\/$|\.html$/.test(url.pathname);
  /* app-code (js, css, json) ook altijd hercontroleren: een nieuwe versie komt zo meteen door, zonder versienummers met de hand aan te passen.
     Ongewijzigde bestanden kosten maar een klein "niet gewijzigd"-antwoord van de server. */
  const fresh = html || (/\.(js|css|json|webmanifest)$/i.test(url.pathname) && !/\/vendor\//.test(url.pathname));
  e.respondWith(fetch(e.request, fresh ? { cache: "no-cache" } : undefined).then(r => { const copy = r.clone(); if (r.ok) caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
