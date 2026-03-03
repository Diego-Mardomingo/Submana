"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getRouteDepth } from "@/lib/navigation";

/**
 * Determine navigation direction based on route depth comparison.
 */
function getNavigationDirection(fromPath: string, toPath: string): "forward" | "back" | "same" {
  const fromDepth = getRouteDepth(fromPath);
  const toDepth = getRouteDepth(toPath);

  if (toDepth > fromDepth) {
    return "forward";
  } else if (toDepth < fromDepth) {
    return "back";
  } else {
    return "same";
  }
}

/**
 * Hook that detects navigation direction (forward/back/same) based on route hierarchy
 * and sets a data attribute on the HTML element for CSS-based directional animations.
 * 
 * Navigation direction is determined by comparing route depth levels:
 * - Moving to a deeper level = forward (slide from right)
 * - Moving to a shallower level = back (slide from left)
 * - Same level = same (crossfade or no animation)
 */
export function useNavigationDirection() {
  const pathname = usePathname();
  const previousPath = useRef<string | null>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!pathname) return;

    // On first render, just store the path without animation
    if (!isInitialized.current) {
      previousPath.current = pathname;
      isInitialized.current = true;
      return;
    }

    // Skip if navigating to the same path
    if (previousPath.current === pathname) {
      return;
    }

    const direction = getNavigationDirection(previousPath.current || "/", pathname);
    
    // Set the direction attribute for CSS animations
    document.documentElement.setAttribute("data-nav-direction", direction);

    // Update previous path
    previousPath.current = pathname;

    // Clean up attribute after transition completes
    const cleanup = setTimeout(() => {
      document.documentElement.removeAttribute("data-nav-direction");
    }, 350);

    return () => clearTimeout(cleanup);
  }, [pathname]);
}
