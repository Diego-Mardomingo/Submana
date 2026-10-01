"use client";

import { useEffect, useMemo } from "react";
import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { monthKey, shiftMonth } from "@/lib/date";
import { metricTransactions } from "@/lib/metricsFilters";
import { queryKeys } from "@/lib/queryKeys";
import { fetchBudgets } from "./useBudgets";
import { useCategories } from "./useCategories";
import { removeById, replaceById, useOptimisticMutation } from "./useOptimisticMutation";

export interface Transaction {
  id: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  description?: string | null;
  account_id?: string | null;
  category_id?: string | null;
  subcategory_id?: string | null;
  account?: { name: string; color?: string | null } | null;
  category?: { name: string } | null;
  subcategory?: { name: string } | null;
}

const NO_TRANSACTIONS: Transaction[] = [];

type Filters = { year?: number; month?: number; accountId?: string };

/** Without year+month the API returns every transaction. */
function fetchTransactions({ year, month, accountId }: Filters = {}): Promise<Transaction[]> {
  const params = new URLSearchParams();
  if (year !== undefined) params.set("year", String(year));
  if (month !== undefined) params.set("month", String(month));
  if (accountId) params.set("account_id", accountId);
  return api(`/api/crud/transactions?${params}`);
}

/** Warms the transactions and budgets caches for a month (1-12). */
export function prefetchMonth(queryClient: QueryClient, year: number, month: number, staleTime = 10 * 60 * 1000) {
  queryClient.prefetchQuery({
    queryKey: queryKeys.transactions.list({ year, month }),
    queryFn: () => fetchTransactions({ year, month }),
    staleTime,
  });
  const key = monthKey(year, month);
  queryClient.prefetchQuery({ queryKey: queryKeys.budgets.list({ month: key }), queryFn: () => fetchBudgets(key), staleTime });
}

/** Transactions of a month (1-12), prefetching the adjacent months. */
export function useTransactions(year?: number, month?: number, accountId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (year === undefined || month === undefined) return;
    for (const delta of [-1, 1]) {
      const adjacent = { ...shiftMonth(year, month, delta), accountId };
      queryClient.prefetchQuery({
        queryKey: queryKeys.transactions.list(adjacent),
        queryFn: () => fetchTransactions(adjacent),
        staleTime: 10 * 60 * 1000,
      });
    }
  }, [year, month, accountId, queryClient]);

  return useQuery({
    queryKey: queryKeys.transactions.list({ year, month, accountId }),
    queryFn: () => fetchTransactions({ year, month, accountId }),
    placeholderData: keepPreviousData,
  });
}

/** Transactions of a month that count for metrics (no transfers or excluded categories). */
export function useMetricTransactions(year?: number, month?: number) {
  const { data = NO_TRANSACTIONS, isLoading, isFetching } = useTransactions(year, month);
  const { data: categories } = useCategories();
  return { data: useMemo(() => metricTransactions(data, categories), [data, categories]), isLoading, isFetching };
}

export interface DateRange {
  startYear: number;
  startMonth: number; // 1-12
  endYear: number;
  endMonth: number; // 1-12
}

/**
 * Every transaction (optionally of one account) grouped by "YYYY-MM". `keys` are the months of
 * `range` (all months with data when omitted) and `availableRange` spans the months with data.
 */
export function useTransactionsRange(accountId?: string, range?: DateRange) {
  const { data = NO_TRANSACTIONS, isLoading } = useTransactions(undefined, undefined, accountId);
  const grouped = useMemo(() => {
    const byMonth = new Map<string, Transaction[]>();
    for (const tx of data) {
      const d = new Date(tx.date);
      if (Number.isNaN(d.getTime())) continue;
      const key = monthKey(d.getFullYear(), d.getMonth() + 1);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(tx);
    }
    const allKeys = [...byMonth.keys()].sort();
    const [first, last] = [allKeys[0], allKeys.at(-1)].map((k) => k?.split("-").map(Number));
    const availableRange: DateRange | null =
      first && last ? { startYear: first[0], startMonth: first[1], endYear: last[0], endMonth: last[1] } : null;
    return { byMonth, allKeys, availableRange };
  }, [data]);

  const keys = useMemo(() => {
    if (!range) return grouped.allKeys;
    const result: string[] = [];
    for (let m = 0; result.length <= 2400; m++) {
      const { year, month } = shiftMonth(range.startYear, range.startMonth, m);
      if (year * 12 + month > range.endYear * 12 + range.endMonth) break;
      result.push(monthKey(year, month));
    }
    return result;
  }, [range, grouped.allKeys]);

  return { ...grouped, keys, isLoading };
}

interface TransactionInput {
  amount: number;
  type: "income" | "expense";
  date: string;
  description?: string;
  account_id?: string;
  category_id?: string;
  subcategory_id?: string;
}

const invalidate = [queryKeys.transactions.all, queryKeys.accounts.all];

export function useCreateTransaction() {
  return useOptimisticMutation({
    mutationFn: (tx: TransactionInput) => api("/api/crud/transactions", "POST", tx),
    invalidate,
  });
}

export function useUpdateTransaction() {
  return useOptimisticMutation({
    mutationFn: ({ id, ...tx }: TransactionInput & { id: string }) => api(`/api/crud/transactions/${id}`, "PATCH", tx),
    queryKey: queryKeys.transactions.lists(),
    update: replaceById,
    invalidate,
  });
}

export function useDeleteTransaction() {
  return useOptimisticMutation({
    mutationFn: (id: string) => api(`/api/crud/transactions/${id}`, "DELETE"),
    queryKey: queryKeys.transactions.lists(),
    update: removeById,
    invalidate,
  });
}
