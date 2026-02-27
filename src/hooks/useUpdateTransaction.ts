"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

interface UpdateTransactionInput {
  id: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  description?: string;
  account_id?: string;
  category_id?: string;
  subcategory_id?: string;
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tx: UpdateTransactionInput) => {
      const { id, ...body } = tx;
      const res = await fetch(`/api/crud/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to update transaction");
      return json.data;
    },

    onMutate: async (updatedTx) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.transactions.lists() });
      const previous = queryClient.getQueriesData({ queryKey: queryKeys.transactions.lists() });
      queryClient.setQueriesData(
        { queryKey: queryKeys.transactions.lists() },
        (old: unknown[] | undefined) =>
          ((old ?? []) as Array<{ id: string }>).map((tx) =>
            tx.id === updatedTx.id ? { ...tx, ...updatedTx } : tx
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
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
  });
}
