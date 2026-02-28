"use client";

import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useEffect } from "react";

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

  const res = await fetch(`/api/crud/transactions?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch transactions");
  const json = await res.json();
  return json.data ?? [];
}

async function fetchTransactionsSimple(year: number, month: number, accountId?: string) {
  const params = new URLSearchParams();
  params.append("year", String(year));
  params.append("month", String(month));
  if (accountId) params.append("account_id", accountId);

  const res = await fetch(`/api/crud/transactions?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch transactions");
  const json = await res.json();
  return json.data ?? [];
}

function getAdjacentMonths(year: number, month: number) {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  
  return {
    prev: { year: prevYear, month: prevMonth },
    next: { year: nextYear, month: nextMonth },
  };
}

export function useTransactions(year?: number, month?: number, accountId?: string) {
  const queryClient = useQueryClient();

  // Prefetch meses adyacentes
  useEffect(() => {
    if (year === undefined || month === undefined) return;
    const { prev, next } = getAdjacentMonths(year, month);
    
    // Prefetch con baja prioridad
    queryClient.prefetchQuery({
      queryKey: queryKeys.transactions.list({ year: prev.year, month: prev.month, accountId }),
      queryFn: () => fetchTransactionsSimple(prev.year, prev.month, accountId),
      staleTime: 10 * 60 * 1000,
    });
    queryClient.prefetchQuery({
      queryKey: queryKeys.transactions.list({ year: next.year, month: next.month, accountId }),
      queryFn: () => fetchTransactionsSimple(next.year, next.month, accountId),
      staleTime: 10 * 60 * 1000,
    });
  }, [year, month, accountId, queryClient]);

  return useQuery({
    queryKey: queryKeys.transactions.list({ year, month, accountId }),
    queryFn: fetchTransactions,
    placeholderData: keepPreviousData,
  });
}
