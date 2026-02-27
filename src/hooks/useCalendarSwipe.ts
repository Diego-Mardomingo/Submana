"use client";

import { useCallback, useEffect, useRef } from "react";

const SWIPE_THRESHOLD = 60;
const SWIPE_RATIO = 2.5; // deltaX debe ser 2.5x mayor que deltaY para considerarse horizontal
const TAP_THRESHOLD = 10;
const SWIPE_TIMEOUT = 300;
const DOUBLE_TAP_MAX_DELAY_MS = 400;
const DOUBLE_TAP_MAX_MOVEMENT_PX = 15;

type SwipeHandlers = {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  /** Doble tap para volver al mes actual */
  onDoubleTap?: () => void;
  /** Swipe de abajo hacia arriba para volver al mes actual */
  onSwipeUp?: () => void;
};

/**
 * Hook para gestos swipe en el calendario (móvil).
 * - Swipe horizontal: cambiar mes (anterior/siguiente).
 * - Swipe vertical hacia arriba: volver al mes actual.
 * - Doble tap: volver al mes actual.
 */
export function useCalendarSwipe(
  elementRef: React.RefObject<HTMLElement | null>,
  { onSwipeLeft, onSwipeRight, onDoubleTap, onSwipeUp }: SwipeHandlers
) {
  const startRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const gestureTypeRef = useRef<"none" | "horizontal" | "vertical">("none");
  const gestureDecidedRef = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      startRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      gestureTypeRef.current = "none";
      gestureDecidedRef.current = false;
    },
    []
  );

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!startRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - startRef.current.x;
    const deltaY = touch.clientY - startRef.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Decidir el tipo de gesto solo una vez
    if (!gestureDecidedRef.current && (absX > TAP_THRESHOLD || absY > TAP_THRESHOLD)) {
      gestureDecidedRef.current = true;
      if (absX > absY * SWIPE_RATIO) {
        gestureTypeRef.current = "horizontal";
      } else if (absY > absX * SWIPE_RATIO) {
        gestureTypeRef.current = "vertical";
      }
    }

    // Solo prevenir scroll si claramente es un swipe horizontal
    if (gestureTypeRef.current === "horizontal" && absX > 30) {
      e.preventDefault();
    }
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
      const elapsed = Date.now() - startRef.current.time;

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

      // Validar swipe: debe ser rápido y claramente direccional
      const isQuickGesture = elapsed < SWIPE_TIMEOUT;

      // Swipe horizontal: cambiar mes
      if (
        gestureTypeRef.current === "horizontal" &&
        absX > SWIPE_THRESHOLD &&
        isQuickGesture &&
        absX > absY * SWIPE_RATIO
      ) {
        if (deltaX > 0) {
          onSwipeRight();
        } else {
          onSwipeLeft();
        }
      }

      // Swipe vertical hacia arriba: volver al mes actual
      if (
        gestureTypeRef.current === "vertical" &&
        absY > SWIPE_THRESHOLD &&
        isQuickGesture &&
        deltaY < 0 &&
        absY > absX * SWIPE_RATIO &&
        onSwipeUp
      ) {
        onSwipeUp();
      }

      startRef.current = null;
      gestureTypeRef.current = "none";
      gestureDecidedRef.current = false;
    },
    [onSwipeLeft, onSwipeRight, onDoubleTap, onSwipeUp]
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
