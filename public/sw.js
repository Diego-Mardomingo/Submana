const CACHE_NAME = 'submana-v2';
const ASSETS_TO_CACHE = [
    '/manifest.json',
    '/favicon.svg',
    '/fonts/Sora-VariableFont_wght.ttf',
    '/icons/web-app-manifest-192x192.png',
    '/icons/web-app-manifest-512x512.png',
    '/icons/favicon.svg',
    '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip caching for auth-related API calls
    if (url.pathname.startsWith('/api/auth/')) {
        return;
    }

    // Stale-While-Revalidate for other API calls
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    const fetchedResponse = fetch(event.request).then((networkResponse) => {
                        if (networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => cachedResponse);
                    return cachedResponse || fetchedResponse;
                });
            })
        );
        return;
    }

    // Network First for Navigation (Pages) to respect Auth checks
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match(event.request);
            })
        );
        return;
    }

    // Cache First for other static assets
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
