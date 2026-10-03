"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { monthKey, shiftMonth, toAppDate } from "@/lib/date";
import { metricTransactions } from "@/lib/metricsFilters";
import { queryKeys } from "@/lib/queryKeys";
import type { TransactionSharedExpense } from "@/lib/shared/types";
import { useJointAccountIds } from "./useAccounts";
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
  /** manual / import / automation: where the row came from. */
  source?: "manual" | "import" | "automation" | "shared";
  /** Date and text of the bank line backing this row (null while it is only a manual entry). */
  booked_at?: string | null;
  bank_description?: string | null;
  /** What counts in metrics and budgets: null = amount, 0 = does not count (settlements). */
  metric_amount?: number | null;
  /** Shared expense or settlement this row belongs to. */
  shared_expense_id?: string | null;
  shared_expense?: TransactionSharedExpense | null;
  category_id?: string | null;
  subcategory_id?: string | null;
  /** Who wrote the row (joint accounts hold rows of several members). */
  user_id?: string;
  account?: { name: string; color?: string | null; is_joint?: boolean } | null;
  /** Author profile on joint-account rows written by another member. */
  author?: { user_id: string; handle: string; display_name: string; avatar_url: string | null } | null;
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

/** Transactions of a month that count for metrics (no joint accounts, transfers or excluded categories). */
export function useMetricTransactions(year?: number, month?: number) {
  const { data = NO_TRANSACTIONS, isLoading, isFetching } = useTransactions(year, month);
  const { data: categories } = useCategories();
  const jointAccountIds = useJointAccountIds();
  return {
    data: useMemo(() => metricTransactions(data, categories, { jointAccountIds }), [data, categories, jointAccountIds]),
    isLoading,
    isFetching,
  };
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
  const { data: allRows = NO_TRANSACTIONS, isLoading } = useTransactions(undefined, undefined, accountId);
  const jointAccountIds = useJointAccountIds();
  // Without an account the history is the personal one: rows of joint accounts are shown on their own.
  const data = useMemo(
    () => (accountId || jointAccountIds.size === 0 ? allRows : allRows.filter((tx) => !tx.account_id || !jointAccountIds.has(tx.account_id))),
    [allRows, accountId, jointAccountIds]
  );
  const grouped = useMemo(() => {
    const byMonth = new Map<string, Transaction[]>();
    for (const tx of data) {
      const d = toAppDate(tx.date);
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

/** A single transaction (e.g. opened from a notification). */
export function useTransaction(id: string | null | undefined) {
  return useQuery<Transaction>({
    queryKey: queryKeys.transactions.detail(id ?? ""),
    queryFn: () => api(`/api/crud/transactions/${id}`),
    enabled: !!id,
  });
}

/** A bank-backed transaction that looks like the one being typed (see /api/crud/transactions/similar). */
export interface SimilarTransaction extends Transaction {
  score: number;
  deltaDays: number;
}

/** Value that follows `value` after it has been stable for `ms`. */
function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** Bank lines similar to a manual transaction being created (debounced; idle until amount, date and account are set). */
export function useSimilarTransactions(input: {
  accountId: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  description: string;
}) {
  const debounced = useDebounced(input, 400);
  const enabled = !!debounced.accountId && debounced.amount > 0 && !!debounced.date;
  return useQuery<SimilarTransaction[]>({
    queryKey: queryKeys.transactions.similar(debounced),
    queryFn: () => {
      const params = new URLSearchParams({
        account_id: debounced.accountId,
        amount: String(debounced.amount),
        type: debounced.type,
        date: debounced.date,
        description: debounced.description,
      });
      return api(`/api/crud/transactions/similar?${params}`);
    },
    enabled,
    staleTime: 30 * 1000,
  });
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

const invalidate = [queryKeys.transactions.all, queryKeys.accounts.all, queryKeys.budgets.all, queryKeys.shared.all];

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
