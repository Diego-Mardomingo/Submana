"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { shiftMonth } from "@/lib/date";
import { localeOf, monthName } from "@/lib/format";
import type { Lang } from "@/lib/i18n/ui";
import { useSwipe } from "./useSwipe";
import { prefetchMonth } from "./useTransactions";

type NavigationUnit = "week" | "month" | "year";

export type MonthNavigation = ReturnType<typeof useMonthNavigation>;

function getWeekRange(date: Date) {
  const start = new Date(date);
  start.setDate(date.getDate() - ((date.getDay() + 6) % 7)); // back to Monday
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatPeriod(date: Date, unit: NavigationUnit, lang: Lang) {
  if (unit === "year") return String(date.getFullYear());
  if (unit === "month") return `${monthName(date.getMonth() + 1, lang, "long")} ${date.getFullYear()}`;
  const { start, end } = getWeekRange(date);
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(localeOf(lang), opts).format(d);
  return `${fmt(start, { day: "numeric", month: "short" })} - ${fmt(end, { day: "numeric", year: "numeric", ...(!sameMonth && { month: "short" }) })}`;
}

/** Moves `date` by `delta` units; months/years clamp the day so Jan 31 + 1 month is Feb 28/29. */
function shiftDate(date: Date, unit: NavigationUnit, delta: number) {
  if (unit === "week") return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7 * delta, 12);
  const { year, month } = shiftMonth(date.getFullYear(), date.getMonth() + 1, unit === "year" ? 12 * delta : delta);
  return new Date(year, month - 1, Math.min(date.getDate(), new Date(year, month, 0).getDate()), 12);
}

const today = () => shiftDate(new Date(), "week", 0);

/** Week/month/year period selector with swipe support and prefetch of neighbouring months. */
export function useMonthNavigation(lang: Lang, unit: NavigationUnit = "month") {
  const [date, setDate] = useState(today);
  const [swipeElement, setSwipeElement] = useState<HTMLElement | null>(null);
  const queryClient = useQueryClient();

  const go = (delta: number) => {
    const next = shiftDate(date, unit, delta);
    setDate(next);
    if (unit === "month") {
      const ahead = shiftMonth(next.getFullYear(), next.getMonth() + 1, delta);
      prefetchMonth(queryClient, ahead.year, ahead.month);
    }
  };
  const goToPrev = () => go(-1);
  const goToNext = () => go(1);
  useSwipe(swipeElement, { onSwipeLeft: goToNext, onSwipeRight: goToPrev }, 60);

  const week = getWeekRange(date);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    weekStart: week.start,
    weekEnd: week.end,
    label: formatPeriod(date, unit, lang),
    // Same period label (language-independent) as today means we are on the current period.
    isCurrent: formatPeriod(date, unit, "en") === formatPeriod(new Date(), unit, "en"),
    goToPrev,
    goToNext,
    goToCurrent: () => setDate(today()),
    setSwipeElement,
  };
}
