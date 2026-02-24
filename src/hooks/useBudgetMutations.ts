"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

interface CreateBudgetInput {
  name: string;
  amount: number;
  color?: string | null;
  category_ids?: string[];
}

export function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBudgetInput) => {
      const res = await fetch("/api/crud/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to create budget");
      return json.data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
    },
  });
}

interface UpdateBudgetInput {
  id: string;
  name?: string;
  amount?: number;
  color?: string | null;
  category_ids?: string[];
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateBudgetInput) => {
      const { id, ...body } = input;
      const res = await fetch(`/api/crud/budgets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to update budget");
      return json.data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/crud/budgets/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to delete budget");
      return json.data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
    },
  });
}
