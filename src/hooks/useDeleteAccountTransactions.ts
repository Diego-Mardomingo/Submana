"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

export type DeleteAccountTransactionsPayload =
  | { mode: "all" }
  | {
      mode: "range";
      startYear: number;
      startMonth: number;
      endYear: number;
      endMonth: number;
    };

export function useDeleteAccountTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      accountId,
      payload,
    }: {
      accountId: string;
      payload: DeleteAccountTransactionsPayload;
    }) => {
      const res = await fetch(`/api/crud/accounts/${accountId}/transactions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { deleted_count: number };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed to delete transactions");
      return json.data ?? { deleted_count: 0 };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
  });
}
