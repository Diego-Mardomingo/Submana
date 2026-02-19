"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

interface CreateTransactionInput {
  amount: number;
  type: "income" | "expense";
  date: string;
  description?: string;
  account_id?: string;
  category_id?: string;
  subcategory_id?: string;
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newTx: CreateTransactionInput) => {
      const res = await fetch("/api/crud/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTx),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to create transaction");
      return json.data;
    },

    onMutate: async (newTx) => {
      const dateObj = new Date(newTx.date);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth();
      const targetKey = queryKeys.transactions.list({ year, month });

      await queryClient.cancelQueries({ queryKey: targetKey });
      const previous = queryClient.getQueryData(targetKey);

      queryClient.setQueryData(targetKey, (old: unknown[] | undefined) => {
        const optimistic = {
          ...newTx,
          id: `temp-${Date.now()}`,
          _optimistic: true,
        };
        return [optimistic, ...(old ?? [])];
      });

      return { previous, targetKey };
    },

    onError: (_err, _vars, context) => {
      if (context?.targetKey && context?.previous) {
        queryClient.setQueryData(context.targetKey, context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
  });
}
