/* قالب فروشگاه | Service Worker: کش کامل برنامه برای کار آفلاین */
const VERSION = 'shop-template-v1';
const FILES = ['./', 'index.html', 'manifest.json', 'css/main.css', 'css/invoice.css', 'css/responsive.css',
  'js/util.js', 'js/db.js', 'js/inventory.js', 'js/products.js', 'js/customers.js', 'js/invoice-sheet.js', 'js/export.js', 'js/invoices.js', 'js/reports.js', 'js/settings.js', 'js/app.js',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png'];
const OPTIONAL = ['assets/fonts/Vazirmatn-Regular.woff2', 'assets/fonts/Vazirmatn-Bold.woff2'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(async c => { await c.addAll(FILES); await Promise.all(OPTIONAL.map(u => c.add(u).catch(() => { }))); }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok && new URL(e.request.url).origin === location.origin) { const cp = res.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); }
    return res;
  }).catch(() => e.request.mode === 'navigate' ? caches.match('index.html') : undefined)));
});
