"use client";

import { useEffect } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { monthKey, shiftMonth } from "@/lib/date";
import { queryKeys } from "@/lib/queryKeys";
import { removeById, replaceById, useOptimisticMutation } from "./useOptimisticMutation";

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

export function fetchBudgets(month?: string): Promise<BudgetWithSpent[]> {
  return api(`/api/crud/budgets${month ? `?month=${encodeURIComponent(month)}` : ""}`);
}

/** Budgets with the amount spent in `month` ("YYYY-MM"), prefetching the adjacent months. */
export function useBudgets(month?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!month) return;
    const [year, m] = month.split("-").map(Number);
    for (const delta of [-1, 1]) {
      const adjacent = shiftMonth(year, m, delta);
      const key = monthKey(adjacent.year, adjacent.month);
      queryClient.prefetchQuery({
        queryKey: queryKeys.budgets.list({ month: key }),
        queryFn: () => fetchBudgets(key),
        staleTime: 10 * 60 * 1000,
      });
    }
  }, [month, queryClient]);

  return useQuery({
    queryKey: queryKeys.budgets.list({ month }),
    queryFn: () => fetchBudgets(month),
    placeholderData: keepPreviousData,
  });
}

interface BudgetInput {
  amount?: number;
  color?: string | null;
  category_ids?: string[];
}

const invalidate = [queryKeys.budgets.all];

export function useCreateBudget() {
  return useOptimisticMutation({
    mutationFn: (input: BudgetInput & { amount: number }) => api("/api/crud/budgets", "POST", input),
    invalidate,
  });
}

export function useUpdateBudget() {
  return useOptimisticMutation({
    mutationFn: ({ id, ...input }: BudgetInput & { id: string }) => api(`/api/crud/budgets/${id}`, "PATCH", input),
    queryKey: queryKeys.budgets.lists(),
    update: replaceById,
    invalidate,
  });
}

export function useDeleteBudget() {
  return useOptimisticMutation({
    mutationFn: (id: string) => api(`/api/crud/budgets/${id}`, "DELETE"),
    queryKey: queryKeys.budgets.lists(),
    update: removeById,
    invalidate,
  });
}
