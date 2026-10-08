"use client";

import { useCallback, useEffect } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { monthKey, shiftMonth } from "@/lib/date";
import { queryKeys } from "@/lib/queryKeys";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { toast } from "@/lib/toast";
import { useCategoryLookup } from "./useCategories";
import { useLang } from "./useLang";
import { removeById, replaceById, useOptimisticMutation } from "./useOptimisticMutation";
import { useUndoableDelete } from "./useUndoableDelete";

export interface BudgetWithSpent {
  id: string;
  user_id: string;
  amount: number;
  color: string | null;
  created_at: string;
  updated_at: string;
  categoryIds: string[];
  spent: number;
}

export function fetchBudgets(month?: string): Promise<BudgetWithSpent[]> {
  return api(`/api/crud/budgets${month ? `?month=${encodeURIComponent(month)}` : ""}`);
}

/** Budgets with the amount spent in `month` ("YYYY-MM"), prefetching the adjacent months. */
export function useBudgets(month?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!month) return;
    const [year, m] = month.split("-").map(Number);
    for (const delta of [-1, 1]) {
      const adjacent = shiftMonth(year, m, delta);
      const key = monthKey(adjacent.year, adjacent.month);
      queryClient.prefetchQuery({
        queryKey: queryKeys.budgets.list({ month: key }),
        queryFn: () => fetchBudgets(key),
        staleTime: 10 * 60 * 1000,
      });
    }
  }, [month, queryClient]);

  return useQuery({
    queryKey: queryKeys.budgets.list({ month }),
    queryFn: () => fetchBudgets(month),
    placeholderData: keepPreviousData,
  });
}

interface BudgetInput {
  amount?: number;
  color?: string | null;
  category_ids?: string[];
}

const invalidate = [queryKeys.budgets.all];

export function useCreateBudget() {
  return useOptimisticMutation({
    mutationFn: (input: BudgetInput & { amount: number }) => api("/api/crud/budgets", "POST", input),
    invalidate,
    meta: { silentError: true }, // the sheet shows the error inline
  });
}

export function useUpdateBudget() {
  return useOptimisticMutation({
    mutationFn: ({ id, ...input }: BudgetInput & { id: string }) => api(`/api/crud/budgets/${id}`, "PATCH", input),
    queryKey: queryKeys.budgets.lists(),
    update: replaceById,
    invalidate,
    meta: { silentError: true },
  });
}

/** Deletes a budget with an Undo toast: it is hidden now and the DELETE is sent when the toast closes. */
export function useUndoableDeleteBudget() {
  const undoableDelete = useUndoableDelete();
  return (budget: Pick<BudgetWithSpent, "id">) =>
    undoableDelete({
      title: "budgets.deleted",
      edits: [{ queryKey: queryKeys.budgets.lists(), remove: (list: BudgetWithSpent[]) => removeById(list, budget.id) }],
      commit: (init) => api(`/api/crud/budgets/${budget.id}`, "DELETE", undefined, init),
      invalidate,
    });
}

/** Top-level categories linked to a budget. */
export const rootIds = (budget: BudgetWithSpent, categories: ReturnType<typeof useCategoryLookup>) => [
  ...new Set(budget.categoryIds.map((id) => categories.parent.get(id) ?? id)),
];

/** A budget is worth a warning from this share of its limit. */
export const BUDGET_WARNING_RATIO = 0.9;

/** Budgets that went from under the warning ratio to over it. Paired by id; a budget missing from `before` is new, so it counts from zero. */
export function budgetsCrossingWarning(before: BudgetWithSpent[], after: BudgetWithSpent[]) {
  const ratio = (budget?: BudgetWithSpent) => (budget && Number(budget.amount) > 0 ? Number(budget.spent ?? 0) / Number(budget.amount) : 0);
  return after.filter((budget) => ratio(budget) >= BUDGET_WARNING_RATIO && ratio(before.find((b) => b.id === budget.id)) < BUDGET_WARNING_RATIO);
}

/**
 * Warns when saving an expense takes a budget to 90 % of its limit (once: only on the crossing).
 * Call it before saving and run the returned function after the save went through.
 */
export function useBudgetWarning() {
  const queryClient = useQueryClient();
  const categories = useCategoryLookup();
  const t = useTranslations(useLang());
  return useCallback(
    async (tx: { type: "income" | "expense"; date: string }) => {
      if (tx.type !== "expense") return async () => {};
      const month = tx.date.slice(0, 7);
      const queryKey = queryKeys.budgets.list({ month });
      try {
        const before: BudgetWithSpent[] =
          queryClient.getQueryData<BudgetWithSpent[]>(queryKey) ?? (await queryClient.fetchQuery({ queryKey, queryFn: () => fetchBudgets(month) }));
        return async () => {
          try {
            const after = await queryClient.fetchQuery({ queryKey, queryFn: () => fetchBudgets(month), staleTime: 0 });
            for (const budget of budgetsCrossingWarning(before, after)) {
              const roots = rootIds(budget, categories);
              const name = roots.length ? roots.map((id) => categories.name.get(id)).filter(Boolean).join(", ") : t("budgets.generalBudget");
              const pct = Math.round((Number(budget.spent) / Number(budget.amount)) * 100);
              toast.warning(interpolate(t("budgets.warning"), { name, pct }));
            }
          } catch {
            // The warning is a courtesy: never fail a saved transaction because of it.
          }
        };
      } catch {
        return async () => {};
      }
    },
    [queryClient, categories, t]
  );
}
