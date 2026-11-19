"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { haptic } from "@/lib/haptics";
import { getParentRoute, getRouteDepth } from "@/lib/navigation";

/** Touches that start this close to the left edge can swipe back. */
const EDGE = 24;
/** Past this share of the width (or with a fast flick) letting go goes back. */
const THRESHOLD = 0.4;
const FLICK = 0.5; // px/ms

const isStandalone = () =>
  matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * Swipe from the left edge to go back from a detail page (an account, a Subcount group), as in
 * iOS. Only in the installed app: in Safari the browser's own gesture already does it. The page
 * follows the finger; letting go past 40 % of the width, or with a flick, slides it out and opens
 * the parent page.
 */
export function EdgeSwipeBack() {
  const pathname = usePathname();
  const router = useRouter();
  const enabled = getRouteDepth(pathname) >= 2;

  // A finished swipe left the page off screen; the new page comes back in place.
  useEffect(() => {
    const root = document.documentElement;
    if (!root.hasAttribute("data-edge-back")) return;
    const shell = document.querySelector<HTMLElement>(".auth-content-shell");
    if (shell) {
      shell.style.transition = "none";
      shell.style.transform = "";
    }
    const timer = setTimeout(() => root.removeAttribute("data-edge-back"), 50);
    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (!enabled || !isStandalone()) return;
    const shell = document.querySelector<HTMLElement>(".auth-content-shell");
    if (!shell) return;
    const root = document.documentElement;
    let start: { x: number; y: number; time: number } | null = null;
    let dragging = false;
    let dx = 0;
    let past = false;

    const place = (x: number, animate: boolean) => {
      shell.style.transition = animate ? "transform 0.3s var(--ease-ios)" : "none";
      shell.style.transform = x ? `translateX(${x}px)` : "";
    };

    const onStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (e.touches.length !== 1 || touch.clientX > EDGE || document.querySelector('[role="dialog"]')) return;
      start = { x: touch.clientX, y: touch.clientY, time: performance.now() };
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const touch = e.touches[0];
      const x = touch.clientX - start.x;
      const y = touch.clientY - start.y;
      if (!dragging) {
        if (Math.abs(y) > 10 && Math.abs(y) > Math.abs(x)) return void (start = null);
        if (x < 10) return;
        dragging = true;
        root.setAttribute("data-edge-dragging", "");
      }
      if (e.cancelable) e.preventDefault();
      dx = Math.max(0, x - 10);
      place(dx, false);
      const nowPast = dx / innerWidth > THRESHOLD;
      if (nowPast && !past) haptic();
      past = nowPast;
    };
    const onEnd = () => {
      if (!start) return;
      const velocity = dx / Math.max(1, performance.now() - start.time);
      const go = dragging && (past || (velocity > FLICK && dx > 40));
      start = null;
      root.removeAttribute("data-edge-dragging");
      if (!dragging) return;
      dragging = false;
      past = false;
      dx = 0;
      if (!go) return place(0, true);
      // Slide the page out, then navigate without the usual page transition.
      root.setAttribute("data-edge-back", "");
      shell.style.transition = "transform 0.25s var(--ease-exit)";
      shell.style.transform = "translateX(100%)";
      const from = window.location.pathname;
      setTimeout(() => router.push(getParentRoute(from)), 230);
      // If the navigation never lands, bring the page back.
      setTimeout(() => {
        if (window.location.pathname !== from) return;
        root.removeAttribute("data-edge-back");
        place(0, true);
      }, 3000);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
      root.removeAttribute("data-edge-dragging");
    };
  }, [enabled, router]);

  return null;
}
