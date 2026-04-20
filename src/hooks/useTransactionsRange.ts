"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

async function fetchAllTransactions({
  queryKey,
}: {
  queryKey: readonly unknown[];
}) {
  const accountId = queryKey[3] as string | undefined;

  const params = new URLSearchParams();
  if (accountId) params.append("account_id", accountId);

  const res = await fetch(`/api/crud/transactions?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch transactions");
  const json = await res.json();
  return json.data ?? [];
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface DateRange {
  startYear: number;
  startMonth: number; // 1-12
  endYear: number;
  endMonth: number; // 1-12
}

function ymKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function keysBetween(range: DateRange): string[] {
  const res: string[] = [];
  let y = range.startYear;
  let m = range.startMonth;
  const endKey = ymKey(range.endYear, range.endMonth);
  while (true) {
    const k = ymKey(y, m);
    res.push(k);
    if (k === endKey) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    // safety valve in case of invalid range
    if (res.length > 2400) break;
  }
  return res;
}

/**
 * Fetches ALL transactions from the database (no date filter).
 * Aggregates by month on the client. Works with 1 month or 5+ years of data.
 * Returns { transactionsByMonth, monthLabels, availableRange, isLoading, isError }
 * where key is "YYYY-MM" (e.g. "2025-02").
 */
export function useTransactionsRange(accountId?: string, range?: DateRange) {
  const { data: allTransactions = [], isLoading, isError } = useQuery({
    queryKey: [...queryKeys.transactions.lists(), "all", accountId] as const,
    queryFn: fetchAllTransactions,
    placeholderData: keepPreviousData,
  });

  const { transactionsByMonth, monthLabels, availableRange, allByMonth, allKeys: sortedAllKeys } = (() => {
    const byMonth = new Map<string, unknown[]>();

    for (const tx of allTransactions as { date?: string }[]) {
      const d = tx.date ? new Date(tx.date) : null;
      if (!d || isNaN(d.getTime())) continue;
      const key = ymKey(d.getFullYear(), d.getMonth() + 1);
      const arr = byMonth.get(key) ?? [];
      arr.push(tx);
      byMonth.set(key, arr);
    }

    const allKeys = Array.from(byMonth.keys()).sort();
    
    let availableRange: DateRange | null = null;
    if (allKeys.length > 0) {
      const [firstYear, firstMonth] = allKeys[0].split("-").map(Number);
      const [lastYear, lastMonth] = allKeys[allKeys.length - 1].split("-").map(Number);
      availableRange = {
        startYear: firstYear,
        startMonth: firstMonth,
        endYear: lastYear,
        endMonth: lastMonth,
      };
    }
    
    let filteredKeys = allKeys;
    if (range) {
      filteredKeys = keysBetween(range);
    }

    const transactionsByMonth: Record<string, unknown[]> = {};
    const monthLabels: { key: string; label: string }[] = [];

    for (const key of filteredKeys) {
      const [y, m] = key.split("-").map(Number);
      transactionsByMonth[key] = byMonth.get(key) ?? [];
      monthLabels.push({
        key,
        label: `${MONTH_NAMES[m - 1]} ${y}`,
      });
    }

    const allByMonth: Record<string, unknown[]> = {};
    for (const key of allKeys) {
      allByMonth[key] = byMonth.get(key) ?? [];
    }

    return { transactionsByMonth, monthLabels, availableRange, allByMonth, allKeys };
  })();

  return {
    transactionsByMonth,
    monthLabels,
    availableRange,
    allByMonth,
    allKeys: sortedAllKeys,
    isLoading,
    isError,
  };
}
