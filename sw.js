// Offline support: the lock screen, app and icons are cached; data files are fetched once by the app.
const CACHE = 'wm-202611041132';
const CORE = ['./', './index.html', './vault.json', './app.bin', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png', './icons/icon-maskable-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/d/')) return;
  const fresh = /vault\.json$|app\.bin$|\/$|index\.html$/.test(u.pathname);
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (fresh) { // network first (picks up updates), cache when offline
      try { const r = await fetch(e.request, { cache: 'no-cache' }); if (r.ok) c.put(e.request, r.clone()); return r; }
      catch { return (await c.match(e.request, { ignoreSearch: true })) || Response.error(); }
    }
    return (await c.match(e.request, { ignoreSearch: true })) || fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; });
  })());
});
