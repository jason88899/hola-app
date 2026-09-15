// Bump this on every deploy so installed phones pick up the new version.
const VERSI = 'v5';
const CACHE = 'hitungstok-' + VERSI;
const SHELL = ['./', './index.html', './styles.css', './app.js', './vendor/xlsx.full.min.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
// Everything the app needs is in the shell, so once installed it never
// touches the network again.
self.addEventListener('fetch', e => {
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
