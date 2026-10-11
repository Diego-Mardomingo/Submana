"use client";

import { useEffect } from "react";
import { getLang, useLang } from "@/hooks/useLang";
import { api } from "@/lib/api";

/** Language already sent in this page load (the server only needs it when it changes). */
let synced: string | null = null;
/** Last request sent; each PUT waits for the previous one so the newest language is the one saved. */
let pending: Promise<unknown> = Promise.resolve();

/**
 * Keeps `notification_settings.lang` equal to the app language, so the server writes pushes in it.
 * Runs once when the app opens and on every language change; fire-and-forget (errors are ignored).
 * Mount it only for signed-in users (the authenticated layout).
 */
export function NotificationLangSync() {
  const lang = useLang();
  useEffect(() => {
    // During hydration `lang` is the server snapshot ("en"), not the user's language: read the cookie itself.
    const current = getLang();
    if (synced === current) return;
    synced = current;
    pending = pending.then(() =>
      api("/api/notifications/settings", "PUT", { lang: current }).catch(() => {
        if (synced === current) synced = null;
      })
    );
  }, [lang]);
  return null;
}
