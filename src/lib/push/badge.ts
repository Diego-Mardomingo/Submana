/**
 * Number on the app icon (browser side). The service worker sets it to the pushes still shown (src/app/sw.ts);
 * the app also caps it at the unread notifications and closes the pushes of what was read in the inbox.
 * Best effort: not every platform has the Badging API or `getNotifications()`.
 */

type BadgeNavigator = Navigator & { setAppBadge?: (count?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

async function shownPushes(): Promise<Notification[]> {
  if (!("serviceWorker" in navigator)) return [];
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.getNotifications() : [];
}

/** Closes the pushes still shown for these inbox notifications (all of them without `ids`). */
export async function closeShownPushes(ids?: string[]) {
  try {
    for (const notification of await shownPushes()) {
      const id = (notification.data as { id?: unknown } | null)?.id;
      if (!ids || (typeof id === "string" && ids.includes(id))) notification.close();
    }
  } catch {
    // Not supported on this platform.
  }
}

/** Sets the number to the pushes still shown, never more than `unread` (the inbox has the last word). */
export async function syncAppBadge(unread: number) {
  const nav = navigator as BadgeNavigator;
  if (!nav.setAppBadge) return;
  try {
    const count = Math.min((await shownPushes()).length, unread);
    if (count > 0) await nav.setAppBadge(count);
    else await nav.clearAppBadge?.();
  } catch {
    // Not allowed on this platform.
  }
}
