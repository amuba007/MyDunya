/* Service worker: membuat aplikasi bisa dibuka cepat & saat offline.
   Strategi: ambil terbaru dari internet; kalau offline pakai salinan tersimpan.
   Permintaan ke Apps Script (domain lain) tidak pernah disentuh/di-cache. */
const V = 'keuangan-v1';
const SHELL = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest',
               './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(r, { cache: 'no-cache' })
      .then(res => { const copy = res.clone(); caches.open(V).then(c => c.put(r, copy)); return res; })
      .catch(() => caches.match(r).then(m => m || caches.match('./index.html')))
  );
});
