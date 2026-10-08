"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { GroupDetailData, SharedExpenseItem, SplitInput } from "@/lib/shared/types";
import { useUndoableDelete } from "./useUndoableDelete";

/** Subcount lives apart from my finances: a write only refreshes the groups and balances. */
function useSharedMutation<TVars, TData = unknown>(mutationFn: (vars: TVars) => Promise<TData>, silentError = false) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    meta: { silentError },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.shared.all }),
  });
}

// The sheets show the errors of creating and editing inline.
export function useCreateSharedExpense() {
  return useSharedMutation((input: SplitInput) => api<{ id: string }>("/api/shared/expenses", "POST", input), true);
}

export function useUpdateSharedExpense() {
  return useSharedMutation(({ id, ...input }: SplitInput & { id: string }) => api(`/api/shared/expenses/${id}`, "PATCH", input), true);
}

export function useDeleteSharedExpense() {
  return useSharedMutation((id: string) => api(`/api/shared/expenses/${id}`, "DELETE"));
}

/** Deletes a shared expense with an Undo toast: it is hidden now and the DELETE is sent when the toast closes. */
export function useUndoableDeleteSharedExpense() {
  const undoableDelete = useUndoableDelete();
  return (expense: Pick<SharedExpenseItem, "id" | "group_id">) =>
    undoableDelete({
      title: "shared.expenseDeleted",
      edits: [
        {
          queryKey: queryKeys.shared.group(expense.group_id),
          remove: (data: GroupDetailData) => ({ ...data, expenses: data.expenses.filter((item) => item.id !== expense.id) }),
        },
      ],
      commit: (init) => api(`/api/shared/expenses/${expense.id}`, "DELETE", undefined, init),
      invalidate: [queryKeys.shared.all],
    });
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
  return useSharedMutation((input: SettlementInput) => api("/api/shared/settlements", "POST", input), true); // the sheet shows the error inline
}
