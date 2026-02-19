"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

async function fetchTransactions({
  queryKey,
}: {
  queryKey: readonly unknown[];
}) {
  const [, , filters] = queryKey;
  const { year, month } = (filters || {}) as { year?: number; month?: number };

  const params = new URLSearchParams();
  if (year !== undefined) params.append("year", String(year));
  if (month !== undefined) params.append("month", String(month));

  const res = await fetch(`/api/crud/transactions?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch transactions");
  const json = await res.json();
  return json.data ?? [];
}

export function useTransactions(year?: number, month?: number) {
  return useQuery({
    queryKey: queryKeys.transactions.list({ year, month }),
    queryFn: fetchTransactions,
    placeholderData: keepPreviousData,
  });
}
