"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

const SWIPE_THRESHOLD = 60;
const SWIPE_RATIO = 2.5;
const TAP_THRESHOLD = 10;
const SWIPE_TIMEOUT = 300;

const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export type NavigationUnit = "week" | "month" | "year";

type UseMonthNavigationOptions = {
  periodUnit?: NavigationUnit;
  swipeUnit?: NavigationUnit;
};

export type MonthNavigation = {
  date: Date;
  year: number;
  month: number; // 1-12
  isCurrentMonth: boolean;
  isCurrentWeek: boolean;
  isCurrentYear: boolean;
  isCurrentPeriod: boolean;
  weekStart: Date;
  weekEnd: Date;
  monthLabel: string;
  weekLabel: string;
  yearLabel: string;
  periodLabel: string;
  goToPrevWeek: () => void;
  goToNextWeek: () => void;
  goToCurrentWeek: () => void;
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
  goToCurrentMonth: () => void;
  goToPrevYear: () => void;
  goToNextYear: () => void;
  goToCurrentYear: () => void;
  goToPrevPeriod: () => void;
  goToNextPeriod: () => void;
  goToCurrentPeriod: () => void;
  setSwipeElement: (el: HTMLElement | null) => void;
};

function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return normalized;
}

function getWeekRange(date: Date): { start: Date; end: Date } {
  const base = startOfDay(date);
  const dayOfWeek = base.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const start = new Date(base);
  start.setDate(base.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatWeekLabel(start: Date, end: Date, lang: string): string {
  const locale = lang === "es" ? "es-ES" : "en-US";
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  const startFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(start);
  const endFmt = new Intl.DateTimeFormat(
    locale,
    sameMonth ? { day: "numeric", year: "numeric" } : { day: "numeric", month: "short", year: "numeric" }
  ).format(end);
  return `${startFmt} - ${endFmt}`;
}

async function prefetchMonth(queryClient: ReturnType<typeof useQueryClient>, year: number, month: number) {
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

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

export function useMonthNavigation(lang: string = "en", options: UseMonthNavigationOptions = {}): MonthNavigation {
  const periodUnit = options.periodUnit ?? "month";
  const swipeUnit = options.swipeUnit ?? periodUnit;
  const now = new Date();
  const [currentDate, setCurrentDate] = useState<Date>(() => startOfDay(now));
  const [swipeElement, setSwipeElement] = useState<HTMLElement | null>(null);
  const queryClient = useQueryClient();
  const startRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const isCurrentYear = year === now.getFullYear();
  const currentWeek = getWeekRange(now);
  const selectedWeek = getWeekRange(currentDate);
  const isCurrentWeek = selectedWeek.start.getTime() === currentWeek.start.getTime();
  const isCurrentPeriod =
    periodUnit === "week" ? isCurrentWeek : periodUnit === "year" ? isCurrentYear : isCurrentMonth;

  const monthNames = lang === "es" ? MONTH_NAMES_ES : MONTH_NAMES_EN;
  const monthLabel = `${monthNames[month - 1]} ${year}`;
  const weekLabel = formatWeekLabel(selectedWeek.start, selectedWeek.end, lang);
  const yearLabel = String(year);
  const periodLabel = periodUnit === "week" ? weekLabel : periodUnit === "year" ? yearLabel : monthLabel;

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

    const nextDate = new Date(currentDate);
    nextDate.setFullYear(newYear, newMonth - 1);
    setCurrentDate(startOfDay(nextDate));

    const prefetchMonthNum = newMonth === 1 ? 12 : newMonth - 1;
    const prefetchYear = newMonth === 1 ? newYear - 1 : newYear;
    prefetchMonth(queryClient, prefetchYear, prefetchMonthNum);
  }, [month, year, queryClient, currentDate]);

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

    const nextDate = new Date(currentDate);
    nextDate.setFullYear(newYear, newMonth - 1);
    setCurrentDate(startOfDay(nextDate));

    const prefetchMonthNum = newMonth === 12 ? 1 : newMonth + 1;
    const prefetchYear = newMonth === 12 ? newYear + 1 : newYear;
    prefetchMonth(queryClient, prefetchYear, prefetchMonthNum);
  }, [month, year, queryClient, currentDate]);

  const goToCurrentMonth = useCallback(() => {
    setCurrentDate(startOfDay(new Date()));
  }, []);

  const goToPrevWeek = useCallback(() => {
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() - 7);
    setCurrentDate(startOfDay(nextDate));
  }, [currentDate]);

  const goToNextWeek = useCallback(() => {
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 7);
    setCurrentDate(startOfDay(nextDate));
  }, [currentDate]);

  const goToCurrentWeek = useCallback(() => {
    setCurrentDate(startOfDay(new Date()));
  }, []);

  const goToPrevYear = useCallback(() => {
    const nextDate = new Date(currentDate);
    nextDate.setFullYear(nextDate.getFullYear() - 1);
    setCurrentDate(startOfDay(nextDate));
  }, [currentDate]);

  const goToNextYear = useCallback(() => {
    const nextDate = new Date(currentDate);
    nextDate.setFullYear(nextDate.getFullYear() + 1);
    setCurrentDate(startOfDay(nextDate));
  }, [currentDate]);

  const goToCurrentYear = useCallback(() => {
    setCurrentDate(startOfDay(new Date()));
  }, []);

  const goToPrevPeriod = useCallback(() => {
    if (periodUnit === "week") {
      goToPrevWeek();
      return;
    }
    if (periodUnit === "year") {
      goToPrevYear();
      return;
    }
    goToPrevMonth();
  }, [periodUnit, goToPrevWeek, goToPrevYear, goToPrevMonth]);

  const goToNextPeriod = useCallback(() => {
    if (periodUnit === "week") {
      goToNextWeek();
      return;
    }
    if (periodUnit === "year") {
      goToNextYear();
      return;
    }
    goToNextMonth();
  }, [periodUnit, goToNextWeek, goToNextYear, goToNextMonth]);

  const goToCurrentPeriod = useCallback(() => {
    if (periodUnit === "week") {
      goToCurrentWeek();
      return;
    }
    if (periodUnit === "year") {
      goToCurrentYear();
      return;
    }
    goToCurrentMonth();
  }, [periodUnit, goToCurrentWeek, goToCurrentYear, goToCurrentMonth]);

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
          if (swipeUnit === "week") {
            goToPrevWeek();
          } else if (swipeUnit === "year") {
            goToPrevYear();
          } else {
            goToPrevMonth();
          }
        } else if (swipeUnit === "week") {
          goToNextWeek();
        } else if (swipeUnit === "year") {
          goToNextYear();
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
  }, [
    swipeElement,
    swipeUnit,
    goToPrevWeek,
    goToNextWeek,
    goToPrevMonth,
    goToNextMonth,
    goToPrevYear,
    goToNextYear,
  ]);

  return {
    date: currentDate,
    year,
    month,
    isCurrentMonth,
    isCurrentWeek,
    isCurrentYear,
    isCurrentPeriod,
    weekStart: selectedWeek.start,
    weekEnd: selectedWeek.end,
    monthLabel,
    weekLabel,
    yearLabel,
    periodLabel,
    goToPrevWeek,
    goToNextWeek,
    goToCurrentWeek,
    goToPrevMonth,
    goToNextMonth,
    goToCurrentMonth,
    goToPrevYear,
    goToNextYear,
    goToCurrentYear,
    goToPrevPeriod,
    goToNextPeriod,
    goToCurrentPeriod,
    setSwipeElement,
  };
}
