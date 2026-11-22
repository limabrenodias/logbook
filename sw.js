/* Logbook service worker — lets the app open and work with no connection.
   • The page itself: network first (so updates arrive at once), saved copy when offline.
   • Scripts, styles, icons, fonts and paintings: served from the saved copy, fetched once.
   • Your data (Supabase) is never cached here — the app keeps its own copy and an outbox. */
const APP = "lb-app-v1", EXT = "lb-ext-v1";
const CORE = ["./", "manifest.webmanifest", "icon.png", "icon-192.png", "apple-touch-icon.png", "art/parasol.jpg", "art/poplars.jpg", "art/sargent.jpg"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(APP);
    await c.addAll(CORE).catch(() => {});
    await precacheFromPage(c);
    self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== APP && k !== EXT) await caches.delete(k);
    await self.clients.claim();
  })());
});

// cache every script and stylesheet the current page uses (their ?v= changes with each update)
async function precacheFromPage(c, html) {
  try {
    if (!html) { const res = await fetch("./", { cache: "no-cache" }); if (!res.ok) return; html = await res.clone().text(); await c.put("./", res); }
    const urls = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?v=\d+)?)"/g)].map(m => m[1]);
    await Promise.all(urls.map(u => c.add(u).catch(() => {})));
    // drop older versions of the same files
    const keep = new Set(urls.map(u => new URL(u, self.registration.scope).href));
    for (const req of await c.keys()) { const u = new URL(req.url); if (u.search.startsWith("?v=") && !keep.has(u.href)) await c.delete(req); }
  } catch (_) {}
}

const EXT_HOSTS = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com", "commons.wikimedia.org", "upload.wikimedia.org"];

self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate") { e.respondWith(page(req)); return; }
  if (url.origin === location.origin) { e.respondWith(cacheFirst(req, APP)); return; }
  if (EXT_HOSTS.includes(url.hostname)) { e.respondWith(cacheFirst(req, EXT)); return; }
  // everything else (Supabase, YouTube…) goes straight to the network
});

async function page(req) {
  const c = await caches.open(APP);
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(req, { signal: ctrl.signal }); clearTimeout(t);
    if (res.ok) { const copy = res.clone(); c.put("./", copy.clone()); copy.text().then(h => precacheFromPage(c, h)); }
    return res;
  } catch (_) {
    return (await c.match("./")) || (await c.match(req)) || new Response("<h1>Offline</h1><p>Open Logbook once with a connection first.</p>", { headers: { "Content-Type": "text/html" } });
  }
}
async function cacheFirst(req, name) {
  const c = await caches.open(name); const hit = await c.match(req);
  if (hit) return hit;
  try { const res = await fetch(req); if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }
  catch (err) { return hit || Response.error(); }
}
