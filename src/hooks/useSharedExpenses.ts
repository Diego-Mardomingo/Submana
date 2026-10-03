"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { SettlementSuggestionItem, SplitInput } from "@/lib/shared/types";

/** Shared expenses move my transactions, budgets and the group balances: refresh all of them. */
function useSharedMutation<TVars, TData = unknown>(mutationFn: (vars: TVars) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () =>
      Promise.all(
        [queryKeys.transactions.all, queryKeys.accounts.all, queryKeys.budgets.all, queryKeys.shared.all].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        )
      ),
  });
}

export function useCreateSharedExpense() {
  return useSharedMutation((input: SplitInput) => api<{ id: string }>("/api/shared/expenses", "POST", input));
}

export function useUpdateSharedExpense() {
  return useSharedMutation(({ id, ...input }: SplitInput & { id: string }) => api(`/api/shared/expenses/${id}`, "PATCH", input));
}

export function useDeleteSharedExpense() {
  return useSharedMutation((id: string) => api(`/api/shared/expenses/${id}`, "DELETE"));
}

/** Links one of my bank transactions to an expense (payer row) or settlement (my side). */
export function useLinkSharedTransaction() {
  return useSharedMutation(({ expenseId, transactionId }: { expenseId: string; transactionId: string }) =>
    api(`/api/shared/expenses/${expenseId}/link`, "POST", { transaction_id: transactionId })
  );
}

export function useUnlinkSharedTransaction() {
  return useSharedMutation((expenseId: string) => api(`/api/shared/expenses/${expenseId}/link`, "DELETE"));
}

export interface SettlementInput {
  group_id: string;
  /** Debtor (pays). */
  from: string;
  /** Creditor (receives). */
  to: string;
  /** Euros. */
  amount: number;
  date?: string;
  transaction_id?: string | null;
}

export function useRecordSettlement() {
  return useSharedMutation((input: SettlementInput) => api("/api/shared/settlements", "POST", input));
}

/** Suggestions to link my recent bank transactions as settlements (empty when nobody owes anything). */
export function useSettlementSuggestions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.shared.suggestions(),
    queryFn: () => api<SettlementSuggestionItem[]>("/api/shared/suggestions"),
    enabled,
    staleTime: 60 * 1000,
  });
}
