"use client";

import { useEffect } from "react";

type BadgeNavigator = Navigator & { setAppBadge?: (count?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

/**
 * Keeps the number on the app icon equal to the pushes still shown, like the service worker does (src/app/sw.ts).
 * Runs whenever the app opens or comes back to the foreground: dismissing a push does not always reach the
 * service worker (iOS has no `notificationclose`), and the number stayed on the icon.
 */
export function AppBadgeSync() {
  useEffect(() => {
    const nav = navigator as BadgeNavigator;
    if (!("serviceWorker" in nav) || !nav.setAppBadge) return;
    const sync = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const registration = await nav.serviceWorker.getRegistration();
        const shown = registration ? (await registration.getNotifications()).length : 0;
        if (shown > 0) await nav.setAppBadge?.(shown);
        else await nav.clearAppBadge?.();
      } catch {
        // Not allowed on this platform.
      }
    };
    void sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return null;
}
