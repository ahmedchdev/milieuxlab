/* ============================================================
   MilieuXlab — service-worker.js
   Handles:
     1. Offline cache (so the app launches without network)
     2. Web Push notifications (called by Vercel Cron via web-push)
     3. Notification click → open the app
   ============================================================ */

const CACHE_NAME = 'milieuxlab-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './pdf.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

/* --- Install: pre-cache the app shell --- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

/* --- Activate: clean old caches --- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* --- Fetch: cache-first for app shell, network-first for everything else --- */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Only cache same-origin GET requests
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        // Don't cache API responses
        if (url.pathname.startsWith('/api/')) return resp;
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return resp;
      }).catch(() => cached);
    })
  );
});

/* --- Push: Vercel Cron sends a Web Push message here --- */
self.addEventListener('push', (event) => {
  let data = { title: 'MilieuXlab', body: 'Vous avez de nouvelles alertes.' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {}
  const title = data.title || 'MilieuXlab';
  const options = {
    body: data.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: data.tag || 'milieuxlab-alert',
    renotify: true,
    requireInteraction: data.urgent === true,
    data: { url: data.url || './index.html' },
    actions: data.urgent ? [
      { action: 'open', title: 'Voir' },
      { action: 'dismiss', title: 'Plus tard' }
    ] : [],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/* --- Notification click: focus the app or open it --- */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : './index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
