"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const STORAGE_KEY = "calendar_hidden_accounts";

function readHidden(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

const CalendarFilterContext = createContext<{
  hiddenAccountIds: Set<string>;
  setHiddenAccountIds: (ids: Set<string>) => void;
} | null>(null);

/** Accounts hidden from the calendar (persisted in this browser). */
export function CalendarFilterProvider({ children }: { children: ReactNode }) {
  const [hiddenAccountIds, setHidden] = useState<Set<string>>(() => (typeof window === "undefined" ? new Set() : readHidden()));

  const setHiddenAccountIds = (ids: Set<string>) => {
    setHidden(ids);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch {
      // Storage unavailable (private mode): the filter still applies for this visit.
    }
  };

  return <CalendarFilterContext.Provider value={{ hiddenAccountIds, setHiddenAccountIds }}>{children}</CalendarFilterContext.Provider>;
}

export function useCalendarAccountFilter() {
  const context = useContext(CalendarFilterContext);
  if (!context) throw new Error("useCalendarAccountFilter must be used within CalendarFilterProvider");
  return {
    ...context,
    isAccountHidden: (accountId: string | null | undefined) => !!accountId && context.hiddenAccountIds.has(accountId),
  };
}
