"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

interface TransactionFilters {
  year?: number;
  month?: number;
  accountId?: string;
}

async function fetchTransactions({
  queryKey,
}: {
  queryKey: readonly unknown[];
}) {
  const [, , filters] = queryKey;
  const { year, month, accountId } = (filters || {}) as TransactionFilters;

  const params = new URLSearchParams();
  if (year !== undefined) params.append("year", String(year));
  if (month !== undefined) params.append("month", String(month));
  if (accountId) params.append("account_id", accountId);

  const res = await fetch(`/api/crud/transactions?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch transactions");
  const json = await res.json();
  return json.data ?? [];
}

export function useTransactions(year?: number, month?: number, accountId?: string) {
  return useQuery({
    queryKey: queryKeys.transactions.list({ year, month, accountId }),
    queryFn: fetchTransactions,
    placeholderData: keepPreviousData,
  });
}
