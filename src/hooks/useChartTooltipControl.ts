"use client";

import { useRef, useEffect, useState } from "react";

const TOOLTIP_HIDDEN_CLASS = "chart-tooltip-hidden";
const TOOLTIP_DISMISSED_CLASS = "chart-tooltip-dismissed";

// Umbrales mejorados para distinguir tap de scroll
const TAP_DISTANCE_THRESHOLD = 15; // px - movimiento máximo para considerarse tap
const TAP_TIME_THRESHOLD = 400; // ms - tiempo máximo para considerarse tap
const SCROLL_BLOCK_DURATION = 250; // ms - bloquear tooltips después de scroll

// Registro global de todos los contenedores de gráficos
const chartContainers = new Set<HTMLDivElement>();

// Timestamp global para bloquear activación de tooltips después de scroll
let globalScrollBlockedUntil = 0;

// Ocultar tooltips de todos los gráficos excepto el especificado
function dismissOtherTooltips(except?: HTMLDivElement) {
  chartContainers.forEach((container) => {
    if (container !== except) {
      container.classList.add(TOOLTIP_DISMISSED_CLASS);
    }
  });
}

// Ocultar todos los tooltips
function dismissAllTooltips() {
  chartContainers.forEach((container) => {
    container.classList.add(TOOLTIP_DISMISSED_CLASS);
  });
}

// Listener global para clicks fuera de gráficos
let globalListenerAttached = false;

function attachGlobalListener() {
  if (globalListenerAttached) return;
  globalListenerAttached = true;

  const handleGlobalInteraction = (e: MouseEvent | TouchEvent) => {
    const target = e.target as HTMLElement;
    
    // Verificar si el click fue dentro de algún gráfico
    let clickedInChart = false;
    chartContainers.forEach((container) => {
      if (container.contains(target)) {
        clickedInChart = true;
      }
    });

    // Si el click fue fuera de todos los gráficos, ocultar todos los tooltips
    if (!clickedInChart) {
      dismissAllTooltips();
    }
  };

  // Detectar scroll global para bloquear tooltips
  const handleGlobalScroll = () => {
    globalScrollBlockedUntil = Date.now() + SCROLL_BLOCK_DURATION;
    dismissAllTooltips();
  };

  document.addEventListener("click", handleGlobalInteraction, { passive: true });
  document.addEventListener("touchend", handleGlobalInteraction, { passive: true });
  window.addEventListener("scroll", handleGlobalScroll, { passive: true, capture: true });
}

/**
 * Hook para controlar el tooltip de gráficos en dispositivos táctiles.
 * - Detecta automáticamente si es dispositivo táctil
 * - Oculta tooltips durante scroll/swipe
 * - Bloquea activación de tooltips por un período después de scroll
 * - Cierra tooltips de otros gráficos cuando se interactúa con uno
 * - Cierra todos los tooltips cuando se hace click fuera
 */
export function useChartTooltipControl() {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isTouch, setIsTouch] = useState(false);

  // Detectar dispositivo táctil
  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia("(pointer: coarse)").matches
      );
    };
    checkTouch();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Registrar este contenedor
    chartContainers.add(container);
    attachGlobalListener();

    const hideTooltip = () => {
      container.classList.add(TOOLTIP_HIDDEN_CLASS);
    };

    const showTooltip = () => {
      // No mostrar si estamos en período de bloqueo post-scroll
      if (Date.now() < globalScrollBlockedUntil) {
        return;
      }
      container.classList.remove(TOOLTIP_HIDDEN_CLASS);
      container.classList.remove(TOOLTIP_DISMISSED_CLASS);
    };

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      // Ocultar tooltip inmediatamente al iniciar touch
      hideTooltip();
      // Ocultar tooltips de otros gráficos
      dismissOtherTooltips(container);
    };

    const handleTouchMove = (e: TouchEvent) => {
      hideTooltip();
      
      // Detectar si es scroll significativo para bloquear tooltips
      if (touchStartRef.current) {
        const touch = e.touches[0];
        if (touch) {
          const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
          if (deltaY > TAP_DISTANCE_THRESHOLD) {
            // Es scroll, bloquear tooltips
            globalScrollBlockedUntil = Date.now() + SCROLL_BLOCK_DURATION;
          }
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) {
        return;
      }

      const touch = e.changedTouches[0];
      if (!touch) {
        touchStartRef.current = null;
        return;
      }

      const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
      const elapsed = Date.now() - touchStartRef.current.time;

      // Usar umbrales más generosos para detectar taps
      const isTap = deltaX < TAP_DISTANCE_THRESHOLD && deltaY < TAP_DISTANCE_THRESHOLD && elapsed < TAP_TIME_THRESHOLD;
      
      if (isTap && Date.now() >= globalScrollBlockedUntil) {
        // Es un tap intencional, mostrar tooltip
        showTooltip();
        // Ocultar tooltips de otros gráficos
        dismissOtherTooltips(container);
      }
      // Si no es tap (es scroll/swipe), no mostrar tooltip

      touchStartRef.current = null;
    };

    // También manejar clicks de mouse para desktop
    const handleMouseDown = () => {
      dismissOtherTooltips(container);
      container.classList.remove(TOOLTIP_DISMISSED_CLASS);
    };

    const handleMouseEnter = () => {
      // En desktop, quitar clase dismissed al hacer hover
      if (!isTouch) {
        container.classList.remove(TOOLTIP_DISMISSED_CLASS);
      }
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    container.addEventListener("mousedown", handleMouseDown, { passive: true });
    container.addEventListener("mouseenter", handleMouseEnter, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("mousedown", handleMouseDown);
      container.removeEventListener("mouseenter", handleMouseEnter);
      // Desregistrar este contenedor
      chartContainers.delete(container);
    };
  }, [isTouch]);

  return { containerRef, isTouch };
}
