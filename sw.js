/* Service worker: keeps a copy of the app on the device so it opens instantly and works offline.
 * Raise VERSION whenever you upload a new version (match appVersion in config.js). */
const VERSION = '2.3.0';
const CACHE = 'mybudget-' + VERSION;
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './config.js',
  './calc.js',
  './smart.js',
  './icons.js',
  './store.js',
  './app.js',
  './screens.js',
  './settings.js',
  './motion.js',
  './manifest.webmanifest',
  './vendor/chart.umd.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mybudget-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // the database backend is never cached

  // Open instantly from the saved copy, refresh it in the background.
  event.respondWith(
    caches.open(CACHE).then((cache) => cache.match(req, { ignoreSearch: true }).then((cached) => {
      const network = fetch(req)
        .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => cached || (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
      return cached || network;
    }))
  );
});
