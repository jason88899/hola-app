// Bump this on every deploy so installed phones pick up the new version.
const VERSI = 'v4';
const CACHE = 'cekstok-' + VERSI;
const SHELL = ['./', './index.html', './styles.css', './config.js', './app.js', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Shell files: cache-first (fast reload). Everything else (Supabase API
// calls, CDN scripts): network-only -- stock numbers must never be served
// stale from a cache.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request))
  );
});
