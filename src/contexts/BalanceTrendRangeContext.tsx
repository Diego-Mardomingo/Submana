"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { DateRange } from "@/hooks/useTransactions";

const BalanceTrendRangeContext = createContext<{
  sharedRange: DateRange | null;
  registerAvailableRange: (key: string, range: DateRange) => void;
} | null>(null);

const startOf = (r: DateRange) => r.startYear * 12 + r.startMonth;
const endOf = (r: DateRange) => r.endYear * 12 + r.endMonth;

/** Balance trend charts register the months they have data for; all of them show the union by default. */
export function BalanceTrendRangeProvider({ children }: { children: React.ReactNode }) {
  const [ranges, setRanges] = useState<Record<string, DateRange>>({});

  const registerAvailableRange = useCallback((key: string, range: DateRange) => {
    setRanges((prev) => (prev[key] && startOf(prev[key]) === startOf(range) && endOf(prev[key]) === endOf(range) ? prev : { ...prev, [key]: range }));
  }, []);

  const sharedRange = useMemo<DateRange | null>(() => {
    const list = Object.values(ranges);
    if (list.length === 0) return null;
    const first = list.reduce((a, b) => (startOf(b) < startOf(a) ? b : a));
    const last = list.reduce((a, b) => (endOf(b) > endOf(a) ? b : a));
    return { startYear: first.startYear, startMonth: first.startMonth, endYear: last.endYear, endMonth: last.endMonth };
  }, [ranges]);

  const value = useMemo(() => ({ sharedRange, registerAvailableRange }), [sharedRange, registerAvailableRange]);
  return <BalanceTrendRangeContext.Provider value={value}>{children}</BalanceTrendRangeContext.Provider>;
}

export function useBalanceTrendRange() {
  const ctx = useContext(BalanceTrendRangeContext);
  if (!ctx) throw new Error("useBalanceTrendRange must be used within BalanceTrendRangeProvider");
  return ctx;
}
