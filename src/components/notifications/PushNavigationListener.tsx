"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { safeInternalPath } from "@/lib/navigation";

/**
 * A push was clicked while the app was open: the service worker does not navigate the window (that would
 * reload it) and posts `{ type: "navigate", url }` instead, so the app navigates on the client.
 */
export function PushNavigationListener() {
  const router = useRouter();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; url?: unknown } | null;
      if (data?.type !== "navigate" || typeof data.url !== "string") return;
      const url = safeInternalPath(data.url, "");
      if (url) router.push(url);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);
  return null;
}
