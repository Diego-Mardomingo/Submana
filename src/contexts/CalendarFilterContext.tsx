"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

const STORAGE_KEY = "calendar_hidden_accounts";

function getStoredHiddenAccounts(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function withViewTransition(callback: () => void) {
  if (
    typeof document !== "undefined" &&
    "startViewTransition" in document &&
    typeof document.startViewTransition === "function"
  ) {
    document.documentElement.setAttribute("data-filter-transition", "true");
    const transition = document.startViewTransition(callback);
    transition.finished.finally(() => {
      document.documentElement.removeAttribute("data-filter-transition");
    });
  } else {
    callback();
  }
}

interface CalendarFilterContextValue {
  hiddenAccountIds: Set<string>;
  hiddenCount: number;
  toggleAccount: (accountId: string) => void;
  showAll: () => void;
  isAccountHidden: (accountId: string | null | undefined) => boolean;
}

const CalendarFilterContext = createContext<CalendarFilterContextValue | null>(
  null
);

export function CalendarFilterProvider({ children }: { children: ReactNode }) {
  const [hiddenAccountIds, setHiddenAccountIds] = useState<Set<string>>(
    getStoredHiddenAccounts
  );

  const toggleAccount = useCallback((accountId: string) => {
    withViewTransition(() => {
      setHiddenAccountIds((prev) => {
        const next = new Set(prev);
        if (next.has(accountId)) {
          next.delete(accountId);
        } else {
          next.add(accountId);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
        return next;
      });
    });
  }, []);

  const showAll = useCallback(() => {
    withViewTransition(() => {
      setHiddenAccountIds(new Set());
      localStorage.removeItem(STORAGE_KEY);
    });
  }, []);

  const isAccountHidden = useCallback(
    (accountId: string | null | undefined) =>
      accountId ? hiddenAccountIds.has(accountId) : false,
    [hiddenAccountIds]
  );

  const hiddenCount = hiddenAccountIds.size;

  const value = useMemo(
    () => ({
      hiddenAccountIds,
      hiddenCount,
      toggleAccount,
      showAll,
      isAccountHidden,
    }),
    [hiddenAccountIds, hiddenCount, toggleAccount, showAll, isAccountHidden]
  );

  return (
    <CalendarFilterContext.Provider value={value}>
      {children}
    </CalendarFilterContext.Provider>
  );
}

export function useCalendarAccountFilter() {
  const context = useContext(CalendarFilterContext);
  if (!context) {
    throw new Error(
      "useCalendarAccountFilter must be used within CalendarFilterProvider"
    );
  }
  return context;
}
