// BEATFORGE Service Worker — Offline Caching
const CACHE_NAME = 'beatforge-v1';
const RUNTIME_CACHE = 'beatforge-runtime-v1';

// Core app shell files to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ─── INSTALL ───
// Pre-cache the app shell so it works offline immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Installing BEATFORGE service worker...');
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching app shell');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ───
// Clean up old caches when a new SW version activates
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new service worker...');
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        cacheNames.filter((name) => !currentCaches.includes(name))
      )
      .then((cachesToDelete) =>
        Promise.all(
          cachesToDelete.map((cache) => {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── FETCH ───
// Strategy: Cache-first for static assets, network-first for API calls
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin API calls (like Anthropic API) — always go to network
  if (url.origin !== self.location.origin) {
    // For the Anthropic API, don't cache — always need fresh responses
    if (url.hostname.includes('anthropic.com')) return;

    // For CDN resources (fonts, etc.) — use stale-while-revalidate
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) =>
        cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse.ok) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        })
      )
    );
    return;
  }

  // For same-origin requests: cache-first strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version, but also update cache in background
        event.waitUntil(
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse.ok) {
                caches
                  .open(CACHE_NAME)
                  .then((cache) => cache.put(request, networkResponse));
              }
            })
            .catch(() => {
              // Network failed, that's fine — we served from cache
            })
        );
        return cachedResponse;
      }

      // Not in cache — fetch from network and cache it
      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches
              .open(RUNTIME_CACHE)
              .then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => {
          // If it's a navigation request, serve the cached index.html
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
    })
  );
});

// ─── HANDLE MESSAGES ───
// Listen for skip-waiting messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] BEATFORGE Service Worker loaded');
