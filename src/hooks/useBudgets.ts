"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

export interface BudgetWithSpent {
  id: string;
  user_id: string;
  name: string;
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

export function useBudgets(month?: string) {
  return useQuery({
    queryKey: queryKeys.budgets.list({ month }),
    queryFn: () => fetchBudgets(month),
  });
}
