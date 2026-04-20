"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { DateRange } from "@/hooks/useTransactionsRange";

type Key = string;

type Ctx = {
  sharedRange: DateRange | null;
  registerAvailableRange: (key: Key, range: DateRange) => void;
};

const BalanceTrendRangeContext = createContext<Ctx | null>(null);

function compareYM(a: { year: number; month: number }, b: { year: number; month: number }) {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export function BalanceTrendRangeProvider({ children }: { children: React.ReactNode }) {
  const [ranges, setRanges] = useState<Record<Key, DateRange>>({});

  const registerAvailableRange = useCallback((key: Key, range: DateRange) => {
    setRanges((prev) => {
      const existing = prev[key];
      if (
        existing &&
        existing.startYear === range.startYear &&
        existing.startMonth === range.startMonth &&
        existing.endYear === range.endYear &&
        existing.endMonth === range.endMonth
      ) {
        return prev;
      }
      return { ...prev, [key]: range };
    });
  }, []);

  const sharedRange = useMemo<DateRange | null>(() => {
    const list = Object.values(ranges);
    if (list.length === 0) return null;

    let start = { year: list[0].startYear, month: list[0].startMonth };
    let end = { year: list[0].endYear, month: list[0].endMonth };

    for (const r of list.slice(1)) {
      const rs = { year: r.startYear, month: r.startMonth };
      const re = { year: r.endYear, month: r.endMonth };
      if (compareYM(rs, start) < 0) start = rs;
      if (compareYM(re, end) > 0) end = re;
    }

    return { startYear: start.year, startMonth: start.month, endYear: end.year, endMonth: end.month };
  }, [ranges]);

  const value = useMemo<Ctx>(() => ({ sharedRange, registerAvailableRange }), [sharedRange, registerAvailableRange]);

  return (
    <BalanceTrendRangeContext.Provider value={value}>
      {children}
    </BalanceTrendRangeContext.Provider>
  );
}

export function useBalanceTrendRange() {
  const ctx = useContext(BalanceTrendRangeContext);
  if (!ctx) {
    throw new Error("useBalanceTrendRange must be used within BalanceTrendRangeProvider");
  }
  return ctx;
}

