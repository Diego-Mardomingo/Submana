"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getParentRoute } from "@/lib/navigation";
import type { NavigateEvent } from "@/types/navigation-api";

/** Paths where we do NOT intercept back (e.g. login, offline). */
const SKIP_PATHS = ["/login", "/~offline"];

function shouldHandle(pathname: string): boolean {
  return !SKIP_PATHS.some((p) => pathname.startsWith(p));
}

/**
 * Intercepts browser/device back (and forward) so that "back" goes to the
 * parent route in the app tree instead of browser history.
 * Mobile-first; works in PWA (standalone) as well.
 */
export function BackNavigationHandler() {
  const pathname = usePathname();
  const router = useRouter();
  const pathnameWeAreOn = useRef<string>(pathname ?? "/");

  useEffect(() => {
    pathnameWeAreOn.current = pathname ?? "/";
  }, [pathname]);

  useEffect(() => {
    if (!pathname || !shouldHandle(pathname)) return;

    const nav = typeof window !== "undefined" ? window.navigation : undefined;

    if (nav) {
      const handleNavigate = (event: NavigateEvent) => {
        if (event.navigationType !== "traverse" || !event.canIntercept) return;
        const fromPath = typeof window !== "undefined" ? window.location.pathname : pathnameWeAreOn.current;
        const parent = getParentRoute(fromPath);
        if (parent === fromPath) return;
        event.intercept({
          async handler() {
            router.replace(parent);
          },
        });
      };

      nav.addEventListener("navigate", handleNavigate);
      return () => nav.removeEventListener("navigate", handleNavigate);
    }

    // Fallback: popstate (browser already navigated; we "correct" to parent if needed)
    const handlePopstate = () => {
      const fromPath = pathnameWeAreOn.current;
      const parent = getParentRoute(fromPath);
      if (parent === fromPath) return;
      const currentUrl = window.location.pathname + window.location.search;
      if (currentUrl.replace(/\/$/, "") === parent.replace(/\/$/, "")) return;
      router.replace(parent);
    };

    window.addEventListener("popstate", handlePopstate);
    return () => window.removeEventListener("popstate", handlePopstate);
  }, [pathname, router]);

  return null;
}
