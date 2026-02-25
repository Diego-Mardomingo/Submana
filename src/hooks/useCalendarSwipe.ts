"use client";

import { useCallback, useEffect, useRef } from "react";

const SWIPE_THRESHOLD = 50;
const DOUBLE_TAP_MAX_DELAY_MS = 400;
const DOUBLE_TAP_MAX_MOVEMENT_PX = 15;

type SwipeHandlers = {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  /** Doble tap para volver al mes actual (sustituye al swipe hacia arriba para no interferir con scroll) */
  onDoubleTap?: () => void;
};

/**
 * Hook para gestos swipe en el calendario (móvil).
 * - Swipe horizontal: cambiar mes (anterior/siguiente).
 * - Swipe vertical: se deja al navegador para scroll (touch-action: pan-y).
 * - Doble tap: volver al mes actual.
 */
export function useCalendarSwipe(
  elementRef: React.RefObject<HTMLElement | null>,
  { onSwipeLeft, onSwipeRight, onDoubleTap }: SwipeHandlers
) {
  const startRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      startRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    },
    []
  );

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!startRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - startRef.current.x;
    const deltaY = touch.clientY - startRef.current.y;

    // Solo prevenir scroll cuando el gesto es claramente horizontal (cambiar mes)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) {
      e.preventDefault();
    }
    // Vertical: no hacer preventDefault → el scroll funciona con touch-action: pan-y
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!startRef.current) return;
      const touch = e.changedTouches[0];
      if (!touch) {
        startRef.current = null;
        return;
      }

      const deltaX = touch.clientX - startRef.current.x;
      const deltaY = touch.clientY - startRef.current.y;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Si fue un tap (poco movimiento), comprobar doble tap
      const isTap = absX < DOUBLE_TAP_MAX_MOVEMENT_PX && absY < DOUBLE_TAP_MAX_MOVEMENT_PX;
      if (isTap && onDoubleTap) {
        const now = Date.now();
        const last = lastTapRef.current;
        if (
          last &&
          now - last.time < DOUBLE_TAP_MAX_DELAY_MS &&
          Math.abs(touch.clientX - last.x) < DOUBLE_TAP_MAX_MOVEMENT_PX &&
          Math.abs(touch.clientY - last.y) < DOUBLE_TAP_MAX_MOVEMENT_PX
        ) {
          lastTapRef.current = null;
          onDoubleTap();
          startRef.current = null;
          return;
        }
        lastTapRef.current = { x: touch.clientX, y: touch.clientY, time: now };
        startRef.current = null;
        return;
      }

      lastTapRef.current = null;

      // Swipe horizontal: cambiar mes
      if (absX > absY && absX > SWIPE_THRESHOLD) {
        if (deltaX > 0) {
          onSwipeRight();
        } else {
          onSwipeLeft();
        }
      }

      startRef.current = null;
    },
    [onSwipeLeft, onSwipeRight, onDoubleTap]
  );

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [elementRef, handleTouchStart, handleTouchMove, handleTouchEnd]);
}
