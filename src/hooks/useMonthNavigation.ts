"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

const SWIPE_THRESHOLD = 60;
const SWIPE_RATIO = 2.5;
const TAP_THRESHOLD = 10;
const SWIPE_TIMEOUT = 300;

export type MonthNavigation = {
  year: number;
  month: number; // 1-12
  isCurrentMonth: boolean;
  monthLabel: string;
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
  goToCurrentMonth: () => void;
  setSwipeElement: (el: HTMLElement | null) => void;
};

const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

async function prefetchMonth(queryClient: ReturnType<typeof useQueryClient>, year: number, month: number) {
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  
  // Prefetch transacciones
  queryClient.prefetchQuery({
    queryKey: queryKeys.transactions.list({ year, month }),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("year", String(year));
      params.append("month", String(month));
      const res = await fetch(`/api/crud/transactions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      const json = await res.json();
      return json.data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });
  
  // Prefetch presupuestos
  queryClient.prefetchQuery({
    queryKey: queryKeys.budgets.list({ month: monthStr }),
    queryFn: async () => {
      const res = await fetch(`/api/crud/budgets?month=${encodeURIComponent(monthStr)}`);
      if (!res.ok) throw new Error("Failed to fetch budgets");
      const json = await res.json();
      return json.data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useMonthNavigation(lang: string = "en"): MonthNavigation {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [swipeElement, setSwipeElement] = useState<HTMLElement | null>(null);
  const queryClient = useQueryClient();

  const startRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  const monthNames = lang === "es" ? MONTH_NAMES_ES : MONTH_NAMES_EN;
  const monthLabel = `${monthNames[month - 1]} ${year}`;

  const goToPrevMonth = useCallback(() => {
    let newMonth: number;
    let newYear: number;
    
    if (month === 1) {
      newMonth = 12;
      newYear = year - 1;
    } else {
      newMonth = month - 1;
      newYear = year;
    }
    
    setMonth(newMonth);
    setYear(newYear);
    
    // Prefetch el mes anterior al nuevo (para swipe continuo)
    const prefetchMonth_num = newMonth === 1 ? 12 : newMonth - 1;
    const prefetchYear = newMonth === 1 ? newYear - 1 : newYear;
    prefetchMonth(queryClient, prefetchYear, prefetchMonth_num);
  }, [month, year, queryClient]);

  const goToNextMonth = useCallback(() => {
    let newMonth: number;
    let newYear: number;
    
    if (month === 12) {
      newMonth = 1;
      newYear = year + 1;
    } else {
      newMonth = month + 1;
      newYear = year;
    }
    
    setMonth(newMonth);
    setYear(newYear);
    
    // Prefetch el mes siguiente al nuevo (para swipe continuo)
    const prefetchMonth_num = newMonth === 12 ? 1 : newMonth + 1;
    const prefetchYear = newMonth === 12 ? newYear + 1 : newYear;
    prefetchMonth(queryClient, prefetchYear, prefetchMonth_num);
  }, [month, year, queryClient]);

  const goToCurrentMonth = useCallback(() => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  }, []);

  useEffect(() => {
    if (!swipeElement) return;

    let isHorizontalSwipe = false;
    let gestureDecided = false;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      startRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      isHorizontalSwipe = false;
      gestureDecided = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!startRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startRef.current.x;
      const deltaY = touch.clientY - startRef.current.y;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (!gestureDecided && (absX > TAP_THRESHOLD || absY > TAP_THRESHOLD)) {
        gestureDecided = true;
        isHorizontalSwipe = absX > absY * SWIPE_RATIO && absX > TAP_THRESHOLD;
      }

      if (isHorizontalSwipe && absX > 30) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
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

      const isValidSwipe =
        isHorizontalSwipe &&
        absX > SWIPE_THRESHOLD &&
        elapsed < SWIPE_TIMEOUT &&
        absX > absY * SWIPE_RATIO;

      if (isValidSwipe) {
        if (deltaX > 0) {
          goToPrevMonth();
        } else {
          goToNextMonth();
        }
      }

      startRef.current = null;
      isHorizontalSwipe = false;
      gestureDecided = false;
    };

    swipeElement.addEventListener("touchstart", handleTouchStart, { passive: true });
    swipeElement.addEventListener("touchmove", handleTouchMove, { passive: false });
    swipeElement.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      swipeElement.removeEventListener("touchstart", handleTouchStart);
      swipeElement.removeEventListener("touchmove", handleTouchMove);
      swipeElement.removeEventListener("touchend", handleTouchEnd);
    };
  }, [swipeElement, goToPrevMonth, goToNextMonth]);

  return {
    year,
    month,
    isCurrentMonth,
    monthLabel,
    goToPrevMonth,
    goToNextMonth,
    goToCurrentMonth,
    setSwipeElement,
  };
}
