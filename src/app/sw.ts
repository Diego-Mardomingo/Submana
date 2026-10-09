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

// ---------------------------------------------------------------------------------------------
// Web push (ver src/lib/notifications/push.ts: el servidor envía { title, body, url, tag, id }).
// ---------------------------------------------------------------------------------------------

const PUSH_ICON = "/icons/web-app-icon-192x192.png";

interface PushData {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  id?: string;
}

/** Whether two Notification objects are the same notification (`getNotifications()` returns new objects). */
const sameNotification = (a: Notification, b: Notification) =>
  a.tag === b.tag && a.title === b.title && a.body === b.body && (a.data as PushData | null)?.id === (b.data as PushData | null)?.id;

/**
 * Number on the app icon: the notifications still shown (best effort, not every platform has it).
 * `closing` is left out: while its close/click event runs, some browsers still list it.
 * The app also calls this logic when it opens (AppBadgeSync), for platforms without `notificationclose`.
 */
async function syncAppBadge(closing?: Notification) {
  try {
    const nav = self.navigator as Navigator & { setAppBadge?: (count?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    const shown = (await self.registration.getNotifications()).filter((n) => !closing || !sameNotification(n, closing)).length;
    if (shown > 0) await nav.setAppBadge?.(shown);
    else await nav.clearAppBadge?.();
  } catch {
    // Not supported or not allowed.
  }
}

self.addEventListener("push", (event) => {
  let data: PushData = {};
  try {
    data = event.data ? ((event.data.json() as PushData | null) ?? {}) : {};
  } catch {
    data = { body: event.data?.text() };
  }
  // The notification is always shown: browsers revoke the permission when a push shows nothing.
  const options: NotificationOptions & { renotify?: boolean } = {
    body: data.body ?? "",
    icon: PUSH_ICON,
    badge: PUSH_ICON,
    data: { url: data.url ?? "/notifications", id: data.id },
  };
  if (data.tag) {
    options.tag = data.tag;
    // A newer push with the same tag replaces the old one, but it must still make a sound.
    options.renotify = true;
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || "Submana", options);
      await syncAppBadge();
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = (event.notification.data as { url?: unknown } | null)?.url;
  // Only paths inside the app (the payload comes from our server, but never trust it blindly).
  const url = typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/notifications";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        // No client.navigate(): it reloads the page. The app navigates on the client (PushNavigationListener).
        await open.focus();
        open.postMessage({ type: "navigate", url });
      } else {
        await self.clients.openWindow(url);
      }
      await syncAppBadge(event.notification);
    })()
  );
});

// Dismissed without tapping it (swiped away or cleared): the number on the icon must go down too.
self.addEventListener("notificationclose", (event) => {
  event.waitUntil(syncAppBadge(event.notification));
});

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

/** The push service rotated or expired the subscription: subscribe again and register it (best effort). */
self.addEventListener("pushsubscriptionchange", (event) => {
  const change = event as Event & { oldSubscription?: PushSubscription | null; waitUntil(promise: Promise<unknown>): void };
  change.waitUntil(
    (async () => {
      try {
        let key: BufferSource | null = change.oldSubscription?.options.applicationServerKey ?? null;
        if (!key) {
          let publicKey: string | undefined;
          try {
            publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          } catch {
            // `process` is not defined in this worker build.
          }
          if (publicKey) key = urlBase64ToUint8Array(publicKey);
        }
        if (!key) return;
        const subscription = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        await fetch("/api/push/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });
      } catch {
        // The user will see the device as off and can enable it again from the profile.
      }
    })()
  );
});
