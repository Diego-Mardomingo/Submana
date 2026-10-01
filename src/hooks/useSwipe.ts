"use client";

import { useEffect, useEffectEvent } from "react";

const SWIPE_RATIO = 2.5; // |dx| must be 2.5x |dy| to count as horizontal
const VERTICAL_SWIPE_RATIO = 1.5;
const TAP_THRESHOLD = 10;
const SWIPE_TIMEOUT = 300;
const DOUBLE_TAP_MAX_DELAY_MS = 400;
const DOUBLE_TAP_MAX_MOVEMENT_PX = 15;

type SwipeHandlers = {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onDoubleTap?: () => void;
  /** Upward swipe (e.g. back to the current month). */
  onSwipeUp?: () => void;
};

/** Touch gestures on `element`: quick horizontal swipes, optional upward swipe and double tap. */
export function useSwipe(element: HTMLElement | null, handlers: SwipeHandlers, threshold = 40) {
  const fire = useEffectEvent((gesture: keyof SwipeHandlers) => handlers[gesture]?.());
  const hasTapOrUp = !!(handlers.onDoubleTap || handlers.onSwipeUp);

  useEffect(() => {
    if (!element) return;
    let start: { x: number; y: number; time: number } | null = null;
    let lastTap: { x: number; y: number; time: number } | null = null;
    let gesture: "none" | "horizontal" | "vertical" = "none";

    const onStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      start = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      gesture = "none";
    };

    const onMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (gesture === "none" && (absX > TAP_THRESHOLD || absY > TAP_THRESHOLD)) {
        if (absX > absY * SWIPE_RATIO) gesture = "horizontal";
        else if (hasTapOrUp && dy < 0 && absY > absX * VERTICAL_SWIPE_RATIO) gesture = "vertical";
      }
      // Block scrolling once the gesture is clearly ours.
      if (e.cancelable && ((gesture === "horizontal" && absX > 30) || gesture === "vertical")) e.preventDefault();
    };

    const onEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      const from = start;
      start = null;
      if (!from || !touch) return;
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const now = Date.now();

      if (hasTapOrUp && absX < DOUBLE_TAP_MAX_MOVEMENT_PX && absY < DOUBLE_TAP_MAX_MOVEMENT_PX) {
        const isDouble =
          lastTap &&
          now - lastTap.time < DOUBLE_TAP_MAX_DELAY_MS &&
          Math.abs(touch.clientX - lastTap.x) < DOUBLE_TAP_MAX_MOVEMENT_PX &&
          Math.abs(touch.clientY - lastTap.y) < DOUBLE_TAP_MAX_MOVEMENT_PX;
        lastTap = isDouble ? null : { x: touch.clientX, y: touch.clientY, time: now };
        if (isDouble) fire("onDoubleTap");
        return;
      }
      lastTap = null;
      if (now - from.time >= SWIPE_TIMEOUT) return;

      if (gesture === "horizontal" && absX > threshold && absX > absY * SWIPE_RATIO) {
        fire(dx > 0 ? "onSwipeRight" : "onSwipeLeft");
      } else if (gesture === "vertical" && absY > threshold && absY > absX * VERTICAL_SWIPE_RATIO) {
        fire("onSwipeUp");
      }
    };

    element.addEventListener("touchstart", onStart, { passive: true });
    element.addEventListener("touchmove", onMove, { passive: false });
    element.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      element.removeEventListener("touchstart", onStart);
      element.removeEventListener("touchmove", onMove);
      element.removeEventListener("touchend", onEnd);
    };
  }, [element, threshold, hasTapOrUp]);
}
