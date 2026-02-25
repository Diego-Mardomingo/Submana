"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

interface TransactionFilters {
  year?: number;
  month?: number;
  accountId?: string;
}

async function fetchAllTransactions({
  queryKey,
}: {
  queryKey: readonly unknown[];
}) {
  const accountId = queryKey[3] as string | undefined;

  const params = new URLSearchParams();
  if (accountId) params.append("account_id", accountId);

  const res = await fetch(`/api/crud/transactions?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch transactions");
  const json = await res.json();
  return json.data ?? [];
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Fetches ALL transactions from the database (no date filter).
 * Aggregates by month on the client. Works with 1 month or 5+ years of data.
 * Returns { transactionsByMonth, monthLabels, isLoading, isError }
 * where key is "YYYY-MM" (e.g. "2025-02").
 */
export function useTransactionsRange(accountId?: string) {
  const { data: allTransactions = [], isLoading, isError } = useQuery({
    queryKey: [...queryKeys.transactions.lists(), "all", accountId] as const,
    queryFn: fetchAllTransactions,
    placeholderData: keepPreviousData,
  });

  const { transactionsByMonth, monthLabels } = (() => {
    const byMonth = new Map<string, unknown[]>();

    for (const tx of allTransactions as { date?: string }[]) {
      const d = tx.date ? new Date(tx.date) : null;
      if (!d || isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const arr = byMonth.get(key) ?? [];
      arr.push(tx);
      byMonth.set(key, arr);
    }

    const keys = Array.from(byMonth.keys()).sort();
    const transactionsByMonth: Record<string, unknown[]> = {};
    const monthLabels: { key: string; label: string }[] = [];

    for (const key of keys) {
      const [y, m] = key.split("-").map(Number);
      transactionsByMonth[key] = byMonth.get(key) ?? [];
      monthLabels.push({
        key,
        label: `${MONTH_NAMES[m - 1]} ${y}`,
      });
    }

    return { transactionsByMonth, monthLabels };
  })();

  return {
    transactionsByMonth,
    monthLabels,
    isLoading,
    isError,
  };
}
