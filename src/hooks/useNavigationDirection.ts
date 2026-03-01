"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Hook that detects navigation direction (forward/back) and sets a data attribute
 * on the HTML element for CSS-based directional animations.
 * 
 * Uses a history stack to track navigation and determine if we're going back
 * to a previously visited page.
 */
export function useNavigationDirection() {
  const pathname = usePathname();
  const historyStack = useRef<string[]>([]);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!pathname) return;

    // On first render, just add to stack without animation direction
    if (!isInitialized.current) {
      historyStack.current.push(pathname);
      isInitialized.current = true;
      return;
    }

    const stack = historyStack.current;
    const previousPath = stack[stack.length - 2];

    // Check if we're navigating back (current path matches the one before last)
    const isBack = previousPath === pathname;

    if (isBack) {
      // Pop the last entry since we're going back
      stack.pop();
      document.documentElement.setAttribute("data-nav-direction", "back");
    } else {
      // Push new path for forward navigation
      stack.push(pathname);
      document.documentElement.setAttribute("data-nav-direction", "forward");
    }

    // Clean up attribute after transition completes
    const cleanup = setTimeout(() => {
      document.documentElement.removeAttribute("data-nav-direction");
    }, 350);

    return () => clearTimeout(cleanup);
  }, [pathname]);
}
