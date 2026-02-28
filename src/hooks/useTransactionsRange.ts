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

  const { transactionsByMonth, monthLabels, availableRange } = (() => {
    const byMonth = new Map<string, unknown[]>();

    for (const tx of allTransactions as { date?: string }[]) {
      const d = tx.date ? new Date(tx.date) : null;
      if (!d || isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const arr = byMonth.get(key) ?? [];
      arr.push(tx);
      byMonth.set(key, arr);
    }

    const allKeys = Array.from(byMonth.keys()).sort();
    
    // Calcular rango disponible
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
    
    // Filtrar por rango si se proporciona
    let filteredKeys = allKeys;
    if (range) {
      const startKey = `${range.startYear}-${String(range.startMonth).padStart(2, "0")}`;
      const endKey = `${range.endYear}-${String(range.endMonth).padStart(2, "0")}`;
      filteredKeys = allKeys.filter(key => key >= startKey && key <= endKey);
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

    return { transactionsByMonth, monthLabels, availableRange };
  })();

  return {
    transactionsByMonth,
    monthLabels,
    availableRange,
    isLoading,
    isError,
  };
}
