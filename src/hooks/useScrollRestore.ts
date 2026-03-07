"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { SCROLL_RESTORE_KEY } from "@/lib/scrollRestore";

function normalizePath(path: string): string {
  const [pathname, search] = path.split("?");
  const base = (pathname || "/").replace(/\/$/, "") || "/";
  return search ? `${base}?${search}` : base;
}

export interface UseScrollRestoreOptions {
  /** Cuando false, espera a que sea true antes de restaurar (útil para listas que cargan datos async) */
  ready?: boolean;
}

export function useScrollRestore(options?: UseScrollRestoreOptions) {
  const { ready = true } = options ?? {};
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    if (typeof window === "undefined" || !pathname || !ready) return;

    const raw = sessionStorage.getItem(SCROLL_RESTORE_KEY);
    if (!raw) return;

    let data: { path: string; scrollY: number };
    try {
      data = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem(SCROLL_RESTORE_KEY);
      return;
    }

    const currentFullPath = normalizePath(pathname + (search ? `?${search}` : ""));
    const storedPath = normalizePath(data.path);

    if (currentFullPath !== storedPath) {
      sessionStorage.removeItem(SCROLL_RESTORE_KEY);
      return;
    }

    sessionStorage.removeItem(SCROLL_RESTORE_KEY);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, data.scrollY);
      });
    });
  }, [pathname, search, ready]);
}
