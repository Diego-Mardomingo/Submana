const CACHE_NAME = 'submana-v7';
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

    // 0. Ignore non-http schemes (e.g. chrome-extension://)
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // 1. API Calls -> Network Only (never cache)
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // 2. HTML Pages (Navigation & SPA Fetch) -> Network First
    // This covers both browser reload (mode: 'navigate') AND Astro client router fetches
    if (event.request.mode === 'navigate' || event.request.headers.get('Accept')?.includes('text/html')) {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    // Update cache with the fresh page so offline works later
                    if (networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                });
            }).catch(() => {
                // Return cached home/page if offline
                return caches.match(event.request);
            })
        );
        return;
    }

    // 3. Static Assets (Images, Fonts, CSS, JS) -> Cache First
    // Only apply to known static extensions to be safe
    const isStaticAsset = /\.(png|jpg|jpeg|svg|gif|webp|css|js|woff|woff2|ttf|ico|json)$/i.test(url.pathname);

    if (isStaticAsset) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request).then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // 4. Fallback for anything else -> Network First
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
