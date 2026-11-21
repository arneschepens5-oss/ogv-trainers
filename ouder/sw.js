// OGV Ouders: de app opent ook zonder internet (met de laatst bekende gegevens). Altijd eerst online.
const CACHE = "ogv-ouders-v22";
const SHELL = ["./", "manifest.webmanifest", "../icons/icon-192.png", "../icons/logo-dark.png", "../icons/apple-touch-icon.png", "../icons/favicon.png", "../tactiekbord/vendor/supabase-2.118.0.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("ogv-ouders-") && k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  const html = e.request.mode === "navigate", fresh = html || (/\.(js|css|json|webmanifest)$/i.test(url.pathname) && !/\/vendor\//.test(url.pathname));
  e.respondWith(fetch(e.request, fresh ? { cache: "no-cache" } : undefined).then(r => { const copy = r.clone(); if (r.ok) caches.open(CACHE).then(c => c.put(html ? "./" : e.request, copy)); return r; })
    .catch(() => caches.match(html ? "./" : e.request)));
});

const ICON = "../icons/icon-192.png";
/* pushmeldingen: tonen en bij een tik de juiste pagina openen */
self.addEventListener("push", e => { let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: "OG Vorselaar", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "OG Vorselaar", { body: d.body || "", icon: ICON, badge: ICON, tag: d.tag, renotify: !!d.tag, data: { url: d.url || "./" } })); });
self.addEventListener("notificationclick", e => { e.notification.close(); const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => { const c = cs.find(x => x.url.split("#")[0] === url.split("#")[0]); if (c) { c.navigate ? c.navigate(url).then(w => (w || c).focus()).catch(() => c.focus()) : c.focus(); return; } return self.clients.openWindow(url); })); });
