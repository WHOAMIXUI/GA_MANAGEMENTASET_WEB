/* Service worker GA Aset: bisa di-install, tahan koneksi buruk, dan menerima push.
   Naikkan VER setiap rilis supaya cache lama dibuang. */
const VER = 'ga-aset-v34';
const SHELL_CACHE = VER + '-shell';
const CDN_CACHE = VER + '-cdn';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/style.css', 'css/tailwind.css', 'css/theme.css', 'css/fontawesome-subset.css', 'css/features.css', 'css/bills.css', 'css/mobile.css', 'css/desktop.css', 'js/desktop.js', 'js/tutorial.js', 'assets/video/tutorial-poster.jpg',
  'assets/fonts/fa-solid-subset.woff2', 'assets/fonts/fa-regular-subset.woff2', 'assets/fonts/fa-brands-subset.woff2',
  'assets/img/logo.png', 'assets/img/logo-2.png', 'assets/img/icon-192.png', 'assets/img/icon-512.png',
  'js/theme.js', 'js/firebase-init.js', 'js/app.js', 'js/new-requests.js', 'js/pwa.js', 'js/mobile.js', 'js/notify-config.js',
  'js/aset/01-core.js', 'js/aset/02-registry.js', 'js/aset/03-vendors.js', 'js/aset/04-market.js',
  'js/aset/05-incidents.js', 'js/aset/06-actions.js', 'js/aset/07-contacts.js', 'js/aset/08-contacts-import.js',
  'js/aset/09-assets-import-disposal.js', 'js/aset/10-integration.js', 'js/aset/11-notifications.js',
  'js/aset/12-opname.js', 'js/aset/13-audit.js', 'js/aset/14-attachments.js', 'js/aset/15-backup-report.js',
  'js/aset/16-notify-settings.js', 'js/aset/17-layout-v2.js', 'js/aset/18-vendor-kontak.js', 'js/aset/19-bills.js', 'js/aset/20-tasks.js', 'js/aset/21-today.js'
];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  // Satu file gagal diunduh tidak boleh membatalkan seluruh instalasi.
  e.waitUntil(caches.open(SHELL_CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keep = [SHELL_CACHE, CDN_CACHE];
    for (const k of await caches.keys()) if (!keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

// Jaringan dulu (supaya selalu versi terbaru), tapi menyerah ke cache setelah 4 detik / saat offline.
function networkFirst(req, cache, fallbackUrl) {
  return new Promise(resolve => {
    let done = false;
    const fromCache = async () => (await caches.match(req, { ignoreSearch: true })) || (fallbackUrl && await caches.match(fallbackUrl));
    const timer = setTimeout(async () => { const c = await fromCache(); if (c && !done) { done = true; resolve(c); } }, 4000);
    fetch(req).then(async res => {
      clearTimeout(timer);
      if (res && res.ok) { const c = await caches.open(cache); c.put(req, res.clone()); }
      if (!done) { done = true; resolve(res); }
    }).catch(async () => {
      clearTimeout(timer);
      const c = await fromCache();
      if (!done) { done = true; resolve(c || new Response('Offline', { status: 503, statusText: 'Offline' })); }
    });
  });
}

// Pustaka CDN sudah punya versi di URL-nya: sajikan dari cache, perbarui diam-diam.
async function staleWhileRevalidate(req) {
  const cache = await caches.open(CDN_CACHE);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || new Response('', { status: 504 });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/sw.js')) return;
    // Video & permintaan range (seek) langsung ke jaringan: respons 206 tidak bisa disimpan di cache.
    if (req.headers.has('range') || /\.(mp4|webm)$/i.test(url.pathname)) return;
    const nav = req.mode === 'navigate';
    e.respondWith(networkFirst(req, SHELL_CACHE, nav ? 'index.html' : null));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(staleWhileRevalidate(req));
  }
  // Selain itu (Firestore, Auth, dll.) dibiarkan lewat: SDK Firebase punya cache offline sendiri.
});

/* ---- Push (FCM Web Push) ---- */
self.addEventListener('push', e => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (_) { p = { body: e.data && e.data.text() }; }
  const n = p.notification || p.data || p;
  const d = p.data || {};
  e.waitUntil(self.registration.showNotification(n.title || 'GA Aset', {
    body: n.body || '',
    icon: 'assets/img/icon-192.png',
    badge: 'assets/img/icon-192.png',
    tag: d.tag || n.tag || undefined,
    data: { url: d.url || n.url || './' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { await c.focus(); if (c.navigate) { try { await c.navigate(target); } catch (_) {} } return; } }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
