// Service worker: cache-first for the app shell, so the whole app works
// offline once it has been loaded once. Bump CACHE_NAME to force an update.
//
// Cache Storage is shared by the whole origin, so this worker only ever
// touches caches under CACHE_PREFIX and only handles requests inside its own
// scope — other apps hosted on the same origin are left alone.
const CACHE_PREFIX = 'grimoire-';
const CACHE_NAME = `${CACHE_PREFIX}v1.1.3`;
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/dice.js',
  './js/rng.js',
  './js/cards.js',
  './js/data.js',
  './js/store.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  // The scope URL includes the origin, so this also skips cross-origin requests.
  if (!request.url.startsWith(self.registration.scope)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => {
            if (cached) return cached;
            if (request.mode === 'navigate') return cache.match('./index.html');
            return Response.error();
          });
        return cached || network;
      })
    )
  );
});
