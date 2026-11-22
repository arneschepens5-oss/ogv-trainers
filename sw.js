// Bewaart het platform op de gsm zodat het snel opent. Gegevens komen altijd eerst online.
const CACHE = "ogv-platform-v230";
const SHELL = ["./", "index.html", "app/app.css?v=230", "app/theme.css?v=230", "app/core.js?v=230", "app/ploeg.js?v=230", "app/cijfers.js?v=230", "app/wedstrijd.js?v=230", "app/leerplan.js?v=230", "app/teken.js?v=230", "app/training.js?v=230", "app/delen.js?v=230", "app/video.js?v=230", "app/map.js?v=230", "app/rbfa.js?v=230", "app/club.js?v=230", "app/evaluatie.js?v=230", "app/evvragen.js?v=230", "app/dossier.js?v=230", "app/trainers.js?v=230", "app/groei.js?v=230", "app/profiel.js?v=230", "app/scoutint.js?v=230", "app/scoutimport.js?v=230", "app/kennis.js?v=230", "app/ouders.js?v=230", "app/clubdash.js?v=230", "app/betalingen.js?v=230", "app/privacy.js?v=230", "app/meldingen.js?v=230", "app/afwezig.js?v=230", "privacy.html", "app/vendor/xlsx-0.18.5.mini.min.js", "pitch.js?v=230",
  "manifest.webmanifest", "manifest-ogv.webmanifest", "manifest-beheer.webmanifest", "icons/ogv-192.png", "icons/ogv-apple-touch-icon.png", "icons/beheer-192.png", "icons/beheer-apple-touch-icon.png", "icons/icon-192.png", "icons/logo.png", "icons/logo-dark.png", "icons/apple-touch-icon.png", "icons/favicon.png", "icons/icon-512.png", "tactiekbord/vendor/supabase-2.118.0.js",
  "trainingen/trainingen.json", "matchday/", "tactiekbord/", "app/embed.css?v=4", "app/embed.js?v=2"];
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

const ICON = "icons/icon-192.png";
/* pushmeldingen: tonen en bij een tik de juiste pagina openen */
self.addEventListener("push", e => { let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: "OG Vorselaar", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "OG Vorselaar", { body: d.body || "", icon: ICON, badge: ICON, tag: d.tag, renotify: !!d.tag, data: { url: d.url || "./" } })); });
self.addEventListener("notificationclick", e => { e.notification.close(); const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => { const c = cs.find(x => x.url.split("#")[0] === url.split("#")[0]); if (c) { c.navigate ? c.navigate(url).then(w => (w || c).focus()).catch(() => c.focus()) : c.focus(); return; } return self.clients.openWindow(url); })); });
