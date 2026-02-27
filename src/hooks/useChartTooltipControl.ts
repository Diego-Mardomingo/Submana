"use client";

import { useRef, useEffect, useState, useCallback } from "react";

const TAP_DISTANCE_THRESHOLD = 15;
const TAP_TIME_THRESHOLD = 400;
const SCROLL_BLOCK_DURATION = 300;

type TooltipDismissCallback = () => void;
const tooltipDismissCallbacks = new Set<TooltipDismissCallback>();
const chartContainers = new Set<HTMLDivElement>();

let globalScrollBlockedUntil = 0;
let globalListenerAttached = false;

function dismissAllTooltips() {
  tooltipDismissCallbacks.forEach((cb) => cb());
}

function dismissOtherTooltips(exceptCallback?: TooltipDismissCallback) {
  tooltipDismissCallbacks.forEach((cb) => {
    if (cb !== exceptCallback) cb();
  });
}

function attachGlobalListener() {
  if (globalListenerAttached) return;
  globalListenerAttached = true;

  const handleGlobalTouch = (e: TouchEvent) => {
    const target = e.target as HTMLElement;
    let touchedChart = false;
    chartContainers.forEach((container) => {
      if (container.contains(target)) touchedChart = true;
    });
    if (!touchedChart) {
      dismissAllTooltips();
    }
  };

  const handleGlobalClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    let clickedChart = false;
    chartContainers.forEach((container) => {
      if (container.contains(target)) clickedChart = true;
    });
    if (!clickedChart) {
      dismissAllTooltips();
    }
  };

  const handleGlobalScroll = () => {
    globalScrollBlockedUntil = Date.now() + SCROLL_BLOCK_DURATION;
    dismissAllTooltips();
  };

  document.addEventListener("touchend", handleGlobalTouch, { passive: true });
  document.addEventListener("click", handleGlobalClick, { passive: true });
  window.addEventListener("scroll", handleGlobalScroll, { passive: true, capture: true });
}

/**
 * Hook para controlar tooltips de gráficos en móviles.
 * Devuelve tooltipKey que debe usarse como key del componente Tooltip
 * para forzar su reset cuando se toca fuera o se hace scroll.
 */
export function useChartTooltipControl() {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const [tooltipKey, setTooltipKey] = useState(0);
  const isScrollingRef = useRef(false);

  const dismissTooltip = useCallback(() => {
    setTooltipKey((k) => k + 1);
  }, []);

  useEffect(() => {
    setIsTouch(
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia("(pointer: coarse)").matches
    );
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    chartContainers.add(container);
    tooltipDismissCallbacks.add(dismissTooltip);
    attachGlobalListener();

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      isScrollingRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;

      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
      const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);

      if (deltaY > TAP_DISTANCE_THRESHOLD || deltaX > TAP_DISTANCE_THRESHOLD) {
        isScrollingRef.current = true;
        globalScrollBlockedUntil = Date.now() + SCROLL_BLOCK_DURATION;
        dismissTooltip();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      if (!touch) {
        touchStartRef.current = null;
        return;
      }

      const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
      const elapsed = Date.now() - touchStartRef.current.time;

      const isTap =
        deltaX < TAP_DISTANCE_THRESHOLD &&
        deltaY < TAP_DISTANCE_THRESHOLD &&
        elapsed < TAP_TIME_THRESHOLD;

      if (isTap && Date.now() >= globalScrollBlockedUntil && !isScrollingRef.current) {
        dismissOtherTooltips(dismissTooltip);
      } else if (isScrollingRef.current) {
        dismissTooltip();
      }

      touchStartRef.current = null;
      isScrollingRef.current = false;
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      chartContainers.delete(container);
      tooltipDismissCallbacks.delete(dismissTooltip);
    };
  }, [dismissTooltip]);

  return { containerRef, isTouch, tooltipKey };
}
