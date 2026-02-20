"use client";

import { useCallback, useEffect, useRef } from "react";

const SWIPE_THRESHOLD = 50;
const SWIPE_VERTICAL_THRESHOLD = 60;

type SwipeHandlers = {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
};

/**
 * Hook para gestos swipe en el calendario. Optimizado para iOS:
 * - Usa passive: false para poder prevenir scroll con preventDefault
 * - touch-action: none en el contenedor para evitar conflicto con scroll nativo
 */
export function useCalendarSwipe(
  elementRef: React.RefObject<HTMLElement | null>,
  { onSwipeLeft, onSwipeRight, onSwipeUp }: SwipeHandlers
) {
  const startRef = useRef<{ x: number; y: number; time: number } | null>(null);

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

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!startRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startRef.current.x;
      const deltaY = touch.clientY - startRef.current.y;

      // Si el movimiento es predominantemente horizontal → prevenir scroll (mes anterior/siguiente)
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) {
        e.preventDefault();
        return;
      }

      // Si el movimiento es predominantemente vertical hacia arriba → prevenir scroll (volver a hoy)
      if (deltaY < -20 && Math.abs(deltaY) > Math.abs(deltaX)) {
        e.preventDefault();
      }
    },
    []
  );

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
      const elapsed = Date.now() - startRef.current.time;
      startRef.current = null;

      // Umbral mínimo de desplazamiento
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Prioridad: si es más horizontal que vertical, cambiar mes
      if (absX > absY && absX > SWIPE_THRESHOLD) {
        if (deltaX > 0) {
          onSwipeRight();
        } else {
          onSwipeLeft();
        }
        return;
      }

      // Swipe vertical hacia arriba = volver al mes actual
      if (deltaY < -SWIPE_VERTICAL_THRESHOLD && absY > absX) {
        onSwipeUp();
      }
    },
    [onSwipeLeft, onSwipeRight, onSwipeUp]
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
