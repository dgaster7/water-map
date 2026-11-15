// Offline support. The lock screen, app and icons are kept on the phone; the map data is stored by the app.
// The app always opens from the phone's copy straight away when the network is slow or missing, and picks up
// a newer version in the background for next time.
const CACHE = 'wm-202611151222';
const CORE = ['./', './index.html', './vault.json', './app.bin?b=202611151222', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png', './icons/icon-maskable-512.png'];
const WAIT_MS = 1500;
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k.startsWith('wm-')).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
async function anyCache(req, ignoreSearch) {
  for (const k of await caches.keys()) { const r = await (await caches.open(k)).match(req, { ignoreSearch }); if (r) return r; }
  return null;
}
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/d/')) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (/app\.bin$/.test(u.pathname)) { // one file per version: use the stored copy if we have it
      const hit = await anyCache(e.request, false);
      if (hit) return hit;
      try { const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; }
      catch { return (await anyCache(e.request, true)) || Response.error(); }
    }
    if (/\/$|index\.html$/.test(u.pathname)) { // the lock screen: open the stored copy at once, refresh it in the background
      const cached = await anyCache(e.request, true);
      const net = fetch(e.request, { cache: 'no-cache' }).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; });
      if (cached) { e.waitUntil(net.catch(() => {})); return cached; }
      return net.catch(() => Response.error());
    }
    if (/vault\.json$/.test(u.pathname)) { // try the network briefly, else the stored copy
      const cached = await anyCache(e.request, true);
      const net = fetch(e.request, { cache: 'no-cache' }).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; });
      if (!cached) return net.catch(() => Response.error());
      return Promise.race([
        net.then((r) => (r.ok ? r : cached)).catch(() => cached),
        new Promise((res) => setTimeout(() => res(cached), WAIT_MS)),
      ]);
    }
    return (await anyCache(e.request, true)) || fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; });
  })());
});
