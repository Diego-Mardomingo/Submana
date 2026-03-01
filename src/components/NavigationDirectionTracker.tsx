"use client";

import { useNavigationDirection } from "@/hooks/useNavigationDirection";

/**
 * Lightweight component that tracks navigation direction for CSS animations.
 * Renders nothing - just runs the direction detection hook.
 */
export function NavigationDirectionTracker() {
  useNavigationDirection();
  return null;
}
