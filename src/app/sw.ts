import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig, RuntimeCaching } from "serwist";
import { Serwist, CacheFirst, NetworkFirst, NetworkOnly, ExpirationPlugin } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const customCache: RuntimeCaching[] = [
  {
    matcher: /^\/_next\/static\/.*/i,
    handler: new CacheFirst({
      cacheName: "static-assets",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 128,
          maxAgeSeconds: 365 * 24 * 60 * 60,
        }),
      ],
    }),
  },
  {
    // Datos financieros por usuario: nunca en Cache Storage. Con stale-while-revalidate
    // el refetch tras una mutación devolvía la respuesta anterior, y la caché sobrevivía
    // al cierre de sesión (visible para el siguiente usuario del dispositivo).
    // Además evita que caigan en la regla "apis" (NetworkFirst) de defaultCache.
    matcher: ({ sameOrigin, url: { pathname } }) => sameOrigin && pathname.startsWith("/api/"),
    handler: new NetworkOnly(),
  },
  {
    matcher: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
    handler: new CacheFirst({
      cacheName: "images",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        }),
      ],
    }),
  },
  {
    matcher: /\.(?:woff|woff2|ttf|otf|eot)$/i,
    handler: new CacheFirst({
      cacheName: "fonts",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 16,
          maxAgeSeconds: 365 * 24 * 60 * 60,
        }),
      ],
    }),
  },
  {
    matcher: ({ request }) => request.destination === "document",
    handler: new NetworkFirst({
      cacheName: "pages",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60,
        }),
      ],
    }),
  },
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: customCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// Purga las cachés de API que versiones anteriores del SW llenaron con datos de usuario.
self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all(["api-data", "apis"].map((name) => caches.delete(name))));
});
