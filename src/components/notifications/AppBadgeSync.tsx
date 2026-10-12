"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotificationCounts } from "@/hooks/useNotifications";
import { closeShownPushes, syncAppBadge } from "@/lib/push/badge";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Keeps the number on the app icon in line with the inbox: the pushes still shown, never more than the unread
 * notifications. With nothing unread the leftover pushes are closed too. Recounts whenever the counts change
 * and when the app comes back to the foreground (iOS has no `notificationclose`, and reading a notification
 * in the app, here or on another device, never reaches the service worker).
 */
export function AppBadgeSync() {
  const queryClient = useQueryClient();
  const { data, dataUpdatedAt } = useNotificationCounts();
  const unread = data?.unread;

  useEffect(() => {
    if (unread === undefined) return;
    void (async () => {
      if (unread === 0) await closeShownPushes();
      await syncAppBadge(unread);
    })();
  }, [unread, dataUpdatedAt]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.counts() });
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [queryClient]);

  return null;
}
