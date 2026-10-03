"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { SplitInput } from "@/lib/shared/types";

/** Subcount lives apart from my finances: a write only refreshes the groups and balances. */
function useSharedMutation<TVars, TData = unknown>(mutationFn: (vars: TVars) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.shared.all }),
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

export interface SettlementInput {
  group_id: string;
  /** Debtor (pays). */
  from: string;
  /** Creditor (receives). */
  to: string;
  /** Euros. */
  amount: number;
  date?: string;
}

export function useRecordSettlement() {
  return useSharedMutation((input: SettlementInput) => api("/api/shared/settlements", "POST", input));
}
