"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getParentRoute, getRouteDepth } from "@/lib/navigation";
import type { NavigateEvent } from "@/types/navigation-api";

/**
 * App-wide navigation behaviour:
 * - browser/device back goes to the parent route of the app tree (also in the installed PWA);
 * - sets `data-nav-direction` (forward/back/same) on <html> so CSS can animate page transitions.
 */
export function NavigationEffects() {
  const pathname = usePathname();
  const router = useRouter();
  const currentPath = useRef(pathname);
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    currentPath.current = pathname;
    const from = previousPath.current;
    previousPath.current = pathname;
    if (from === null || from === pathname) return;
    const delta = getRouteDepth(pathname) - getRouteDepth(from);
    document.documentElement.setAttribute("data-nav-direction", delta > 0 ? "forward" : delta < 0 ? "back" : "same");
    const timer = setTimeout(() => document.documentElement.removeAttribute("data-nav-direction"), 350);
    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const parentOf = (path: string) => {
      const parent = getParentRoute(path);
      return parent === path ? null : parent;
    };
    // Navigation API: replace the history traversal with a jump to the parent route.
    const onNavigate = (event: NavigateEvent) => {
      const parent = parentOf(window.location.pathname);
      if (event.navigationType !== "traverse" || !event.canIntercept || !parent) return;
      event.intercept({ handler: async () => router.replace(parent) });
    };
    // Fallback: the browser already went back; correct it to the parent if needed.
    const onPopstate = () => {
      const parent = parentOf(currentPath.current);
      if (parent && window.location.pathname.replace(/\/$/, "") !== parent.replace(/\/$/, "")) router.replace(parent);
    };
    const nav = window.navigation;
    if (nav) nav.addEventListener("navigate", onNavigate);
    else window.addEventListener("popstate", onPopstate);
    return () => {
      nav?.removeEventListener("navigate", onNavigate);
      window.removeEventListener("popstate", onPopstate);
    };
  }, [router]);

  return null;
}
