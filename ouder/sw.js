// OGV Ouders: de app opent ook zonder internet (met de laatst bekende gegevens). Altijd eerst online.
const CACHE = "ogv-ouders-v6";
const SHELL = ["./", "manifest.webmanifest", "../icons/icon-192.png", "../icons/logo-dark.png", "../icons/apple-touch-icon.png", "../icons/favicon.png", "../tactiekbord/vendor/supabase-2.118.0.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("ogv-ouders-") && k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  const html = e.request.mode === "navigate";
  e.respondWith(fetch(e.request, html ? { cache: "no-cache" } : undefined).then(r => { const copy = r.clone(); if (r.ok) caches.open(CACHE).then(c => c.put(html ? "./" : e.request, copy)); return r; })
    .catch(() => caches.match(html ? "./" : e.request)));
});
