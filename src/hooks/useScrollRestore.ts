"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { SCROLL_RESTORE_KEY } from "@/lib/scrollRestore";

export function useScrollRestore() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined" || !pathname) return;

    const raw = sessionStorage.getItem(SCROLL_RESTORE_KEY);
    if (!raw) return;

    let data: { path: string; scrollY: number };
    try {
      data = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem(SCROLL_RESTORE_KEY);
      return;
    }

    sessionStorage.removeItem(SCROLL_RESTORE_KEY);

    const currentPath = pathname.replace(/\/$/, "") || "/";
    const storedPath = data.path.replace(/\/$/, "") || "/";

    if (currentPath !== storedPath) return;

    requestAnimationFrame(() => {
      window.scrollTo(0, data.scrollY);
    });
  }, [pathname]);
}
