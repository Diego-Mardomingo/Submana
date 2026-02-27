"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

interface CreateBudgetInput {
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

    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budgets.lists() });
      const previous = queryClient.getQueriesData({ queryKey: queryKeys.budgets.lists() });
      queryClient.setQueriesData(
        { queryKey: queryKeys.budgets.lists() },
        (old: unknown[] | undefined) =>
          ((old ?? []) as Array<{ id: string }>).map((budget) =>
            budget.id === id ? { ...budget, ...updates } : budget
          )
      );
      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        context.previous.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
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

    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budgets.lists() });
      const previous = queryClient.getQueriesData({ queryKey: queryKeys.budgets.lists() });
      queryClient.setQueriesData(
        { queryKey: queryKeys.budgets.lists() },
        (old: unknown[] | undefined) =>
          ((old ?? []) as Array<{ id: string }>).filter((budget) => budget.id !== deletedId)
      );
      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        context.previous.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
    },
  });
}
