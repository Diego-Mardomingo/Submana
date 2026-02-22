"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/crud/transactions/${id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to delete transaction");
      return json.data;
    },

    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.transactions.lists(),
      });
      const previous = queryClient.getQueriesData({
        queryKey: queryKeys.transactions.lists(),
      });
      queryClient.setQueriesData(
        { queryKey: queryKeys.transactions.lists() },
        (old: unknown[] | undefined) =>
          ((old ?? []) as Array<{ id: string }>).filter((tx) => tx.id !== deletedId)
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
