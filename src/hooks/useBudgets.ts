"use client";

import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useEffect } from "react";

export interface BudgetWithSpent {
  id: string;
  user_id: string;
  amount: number;
  color: string | null;
  created_at: string;
  updated_at: string;
  categoryIds: string[];
  spent: number;
}

async function fetchBudgets(month?: string): Promise<BudgetWithSpent[]> {
  const params = month ? `?month=${encodeURIComponent(month)}` : "";
  const res = await fetch(`/api/crud/budgets${params}`);
  if (!res.ok) throw new Error("Failed to fetch budgets");
  const json = await res.json();
  return json.data ?? [];
}

function getAdjacentMonths(month: string): { prev: string; next: string } {
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? year - 1 : year;
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? year + 1 : year;
  
  return {
    prev: `${prevYear}-${String(prevMonth).padStart(2, "0")}`,
    next: `${nextYear}-${String(nextMonth).padStart(2, "0")}`,
  };
}

export function useBudgets(month?: string) {
  const queryClient = useQueryClient();

  // Prefetch meses adyacentes
  useEffect(() => {
    if (!month) return;
    const { prev, next } = getAdjacentMonths(month);
    
    // Prefetch con baja prioridad (no bloquea la UI)
    queryClient.prefetchQuery({
      queryKey: queryKeys.budgets.list({ month: prev }),
      queryFn: () => fetchBudgets(prev),
      staleTime: 10 * 60 * 1000, // 10 minutos para prefetch
    });
    queryClient.prefetchQuery({
      queryKey: queryKeys.budgets.list({ month: next }),
      queryFn: () => fetchBudgets(next),
      staleTime: 10 * 60 * 1000,
    });
  }, [month, queryClient]);

  return useQuery({
    queryKey: queryKeys.budgets.list({ month }),
    queryFn: () => fetchBudgets(month),
    placeholderData: keepPreviousData,
  });
}
