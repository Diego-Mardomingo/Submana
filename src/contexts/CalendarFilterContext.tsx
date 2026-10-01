"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { withViewTransition } from "@/lib/viewTransition";

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
  toggleAccount: (accountId: string) => void;
  showAll: () => void;
} | null>(null);

/** Accounts hidden from the calendar (persisted in this browser). */
export function CalendarFilterProvider({ children }: { children: ReactNode }) {
  const [hiddenAccountIds, setHidden] = useState<Set<string>>(() => (typeof window === "undefined" ? new Set() : readHidden()));

  const update = (next: Set<string>) =>
    withViewTransition(() => {
      setHidden(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    }, "data-filter-transition");

  const toggleAccount = (accountId: string) => {
    const next = new Set(hiddenAccountIds);
    if (!next.delete(accountId)) next.add(accountId);
    update(next);
  };

  return (
    <CalendarFilterContext.Provider value={{ hiddenAccountIds, toggleAccount, showAll: () => update(new Set()) }}>{children}</CalendarFilterContext.Provider>
  );
}

export function useCalendarAccountFilter() {
  const context = useContext(CalendarFilterContext);
  if (!context) throw new Error("useCalendarAccountFilter must be used within CalendarFilterProvider");
  return {
    ...context,
    isAccountHidden: (accountId: string | null | undefined) => !!accountId && context.hiddenAccountIds.has(accountId),
  };
}
