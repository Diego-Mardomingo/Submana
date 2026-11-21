"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { ReviewAction, ReviewQueue, ReviewSummary, ReviewUndo } from "@/lib/review/types";
import type { CategoryPair } from "@/lib/review/classify";

/** The deck's cards (with alternatives and the "why" of each). */
export function useReviewQueue(enabled = true) {
  return useQuery({
    queryKey: queryKeys.transactions.review(),
    queryFn: () => api<ReviewQueue>("/api/review"),
    enabled,
    staleTime: 30_000,
  });
}

/** How many cards are waiting and the first three: the nav's badge, Home's card and the + menu. */
export function useReviewSummary(enabled = true) {
  return useQuery({
    queryKey: queryKeys.transactions.reviewSummary(),
    queryFn: () => api<ReviewSummary>("/api/review?summary=1"),
    enabled,
    staleTime: 60_000,
  });
}

/**
 * One card's decision. Doesn't refetch the deck while it is open (the cards would reshuffle under the finger):
 * the movements, budgets and the summary refresh; the deck itself on `refreshDeck`.
 */
export function useReviewAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: ReviewAction & { id: string }) => api<{ undo: ReviewUndo }>(`/api/review/${id}`, "POST", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.reviewSummary() });
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.reviewRules() });
    },
  });
}

export interface CategoryRuleItem extends CategoryPair {
  id: string;
  pattern: string;
  created_at: string;
}

/** Rules the deck learnt, for the categories screen. */
export function useCategoryRules(enabled = true) {
  return useQuery({
    queryKey: queryKeys.transactions.reviewRules(),
    queryFn: () => api<CategoryRuleItem[]>("/api/review/rules"),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDeleteCategoryRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/review/rules/${id}`, "DELETE"),
    onMutate: async (id) => {
      const key = queryKeys.transactions.reviewRules();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CategoryRuleItem[]>(key);
      queryClient.setQueryData<CategoryRuleItem[]>(key, (rules) => rules?.filter((rule) => rule.id !== id));
      return { previous };
    },
    onError: (_error, _id, context) => queryClient.setQueryData(queryKeys.transactions.reviewRules(), context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.transactions.reviewRules() }),
  });
}
