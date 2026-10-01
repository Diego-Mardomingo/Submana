"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const KEY = "submana_scroll_restore";
const normalize = (path: string) => path.replace(/\/(?=\?|$)/, "") || "/";

/** Remembers the scroll position to restore when coming back to `path` (e.g. after editing an item). */
export function saveScrollForReturn(path: string) {
  sessionStorage.setItem(KEY, JSON.stringify({ path, scrollY: window.scrollY }));
}

/** Restores a position saved by `saveScrollForReturn` for this URL once `ready` (e.g. data loaded). */
export function useScrollRestore({ ready = true }: { ready?: boolean } = {}) {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    const raw = ready && sessionStorage.getItem(KEY);
    if (!raw) return;
    sessionStorage.removeItem(KEY);
    try {
      const { path, scrollY } = JSON.parse(raw) as { path: string; scrollY: number };
      if (normalize(path) !== normalize(pathname + (search ? `?${search}` : ""))) return;
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, scrollY)));
    } catch {
      // Ignore corrupted entries.
    }
  }, [pathname, search, ready]);
}
