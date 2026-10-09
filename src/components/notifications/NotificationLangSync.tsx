"use client";

import { useEffect } from "react";
import { useLang } from "@/hooks/useLang";
import { api } from "@/lib/api";

/** Language already sent in this page load (the server only needs it when it changes). */
let synced: string | null = null;

/**
 * Keeps `notification_settings.lang` equal to the app language, so the server writes pushes in it.
 * Runs once when the app opens and on every language change; fire-and-forget (errors are ignored).
 * Mount it only for signed-in users (the authenticated layout).
 */
export function NotificationLangSync() {
  const lang = useLang();
  useEffect(() => {
    if (synced === lang) return;
    synced = lang;
    api("/api/notifications/settings", "PUT", { lang }).catch(() => {
      synced = null;
    });
  }, [lang]);
  return null;
}
