"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Route depth map for navigation hierarchy.
 * 
 * Depth levels:
 * - 0: Home (root)
 * - 1: Main pages (nav items)
 * - 2: Detail/Create pages
 * - 3: Edit pages
 */
const STATIC_ROUTE_DEPTH: Record<string, number> = {
  "/": 0,
  "/dashboard": 1,
  "/transactions": 1,
  "/accounts": 1,
  "/subscriptions": 1,
  "/categories": 1,
  "/budgets": 1,
  "/notifications": 1,
  "/settings": 1,
  "/transactions/new": 2,
  "/subscriptions/new": 2,
};

/**
 * Get the depth level for a given route path.
 * Handles both static routes and dynamic routes with parameters.
 */
function getRouteDepth(path: string): number {
  // Check static routes first
  if (STATIC_ROUTE_DEPTH[path] !== undefined) {
    return STATIC_ROUTE_DEPTH[path];
  }

  // Handle dynamic routes
  const segments = path.split("/").filter(Boolean);

  // /account/[id] or /subscription/[id] -> depth 2
  if (segments.length === 2 && (segments[0] === "account" || segments[0] === "subscription")) {
    return 2;
  }

  // /account/[id]/edit or /subscription/[id]/edit -> depth 3
  if (segments.length === 3 && segments[2] === "edit") {
    return 3;
  }

  // /transactions/edit/[id] -> depth 3
  if (segments.length === 3 && segments[0] === "transactions" && segments[1] === "edit") {
    return 3;
  }

  // Default to depth 1 for unknown routes
  return 1;
}

type NavigationDirection = "forward" | "back" | "same";

/**
 * Determine navigation direction based on route depth comparison.
 */
function getNavigationDirection(fromPath: string, toPath: string): NavigationDirection {
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
