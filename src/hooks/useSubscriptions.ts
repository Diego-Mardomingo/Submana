"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { SharedSplit } from "@/lib/shared/subscriptionSplit";
import type { LinkedCharge, PriceStep, ReviewCharge } from "@/lib/subscriptionReconciliation";
import { removeById, replaceById, useOptimisticMutation } from "./useOptimisticMutation";
import { useUndoableDelete } from "./useUndoableDelete";

export interface Subscription {
  id: string;
  service_name: string;
  icon?: string | null;
  cost: number;
  start_date: string;
  end_date?: string | null;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  frequency_value: number;
  account_id?: string | null;
  /** Days before a charge on which a reminder is sent (0, 1, 3, 7); empty = no reminders. */
  reminder_offsets: number[];
  /** Bank text learned when a charge was linked; recognises the next ones. */
  match_pattern?: string | null;
  /** YYYY-MM-DD charges the user marked as not charged. */
  skipped_charges?: string[] | null;
  /** YYYY-MM-DD of the charge whose other amount the user chose to ignore. */
  dismissed_price_charge?: string | null;
  /** Price steps, oldest first. */
  price_history?: PriceStep[] | null;
  /** Transactions linked to its charges. */
  charges?: LinkedCharge[] | null;
  /** Transactions that may be one of its charges, waiting for the user. */
  reviews?: ReviewCharge[] | null;
  /** When its charges were last looked for among the existing transactions. */
  auto_reconciled_at?: string | null;
  /** Subcount group each charge is added to as an expense paid by me (null: not shared). */
  shared_group_id?: string | null;
  /** How each charge is split in that group. */
  shared_split?: SharedSplit | null;
  /** YYYY-MM-DD it was shared on: charges from then on go to the group. */
  shared_from?: string | null;
  /** The group expenses its charges created (deleted ones included, with deleted_at). */
  group_expenses?: { id: string; subscription_charge_date: string; deleted_at: string | null }[] | null;
}

export function useSubscriptions() {
  return useQuery<Subscription[]>({
    queryKey: queryKeys.subscriptions.lists(),
    queryFn: () => api("/api/crud/subscriptions"),
    staleTime: 10 * 60 * 1000,
  });
}

interface SubscriptionInput {
  service_name?: string;
  icon?: string;
  cost?: number;
  start_date?: string;
  end_date?: string | null;
  frequency?: string;
  frequency_value?: number;
  account_id?: string | null;
  reminder_offsets?: number[];
  match_pattern?: string | null;
  shared_group_id?: string | null;
  shared_split?: SharedSplit | null;
}

// A shared subscription may add expenses to its Subcount group.
const invalidate = [queryKeys.subscriptions.all, queryKeys.shared.all];

export function useCreateSubscription() {
  return useOptimisticMutation({
    mutationFn: (input: SubscriptionInput & { service_name: string }) => api("/api/crud/subscriptions", "POST", input),
    invalidate,
    meta: { silentError: true }, // the sheet shows the error inline
  });
}

/** `silentError`: the caller shows the error itself (the edit sheet, inline). */
export function useUpdateSubscription({ silentError = false } = {}) {
  return useOptimisticMutation({
    mutationFn: ({ id, ...input }: SubscriptionInput & { id: string }) => api(`/api/crud/subscriptions/${id}`, "PATCH", input),
    queryKey: queryKeys.subscriptions.lists(),
    update: replaceById,
    invalidate,
    meta: { silentError },
  });
}

/** Deletes a subscription with an Undo toast: it is hidden now and the DELETE is sent when the toast closes. */
export function useUndoableDeleteSubscription() {
  const undoableDelete = useUndoableDelete();
  return (sub: Pick<Subscription, "id">) =>
    undoableDelete({
      title: "sub.deleted",
      edits: [{ queryKey: queryKeys.subscriptions.lists(), remove: (list: Subscription[]) => removeById(list, sub.id) }],
      commit: (init) => api(`/api/crud/subscriptions/${sub.id}`, "DELETE", undefined, init),
      invalidate,
    });
}

const invalidateLinks = [queryKeys.subscriptions.all, queryKeys.transactions.all, queryKeys.shared.all];

export type ChargeAction = "accept_price" | "undo_price" | "dismiss_price" | "undismiss_price" | "skip" | "unskip";

/** Decide about one charge (update or ignore a new price, mark it as not charged); returns the subscription. */
export function useChargeAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, chargeDate }: { id: string; action: ChargeAction; chargeDate: string }) =>
      api<Subscription>(`/api/crud/subscriptions/${id}/charges`, "POST", { action, charge_date: chargeDate }),
    onSuccess: (sub) => queryClient.setQueryData<Subscription[]>(queryKeys.subscriptions.lists(), (list) => list && replaceById(list, sub)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all }),
    meta: { silentError: true }, // callers show a toast
  });
}

/**
 * Link a transaction to a subscription's charge (`chargeDate` omitted: the closest one), or unlink it with
 * `subscriptionId: null`. Resolves to the charge date it was linked to.
 */
export function useLinkTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ transactionId, subscriptionId, chargeDate }: { transactionId: string; subscriptionId: string | null; chargeDate?: string }) =>
      api<{ charge_date?: string; group_expense?: { id: string; group_id: string } | null }>(`/api/crud/transactions/${transactionId}/subscription`, "PUT", {
        subscription_id: subscriptionId,
        ...(chargeDate && { charge_date: chargeDate }),
      }),
    onSettled: () => Promise.all(invalidateLinks.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
    meta: { silentError: true },
  });
}

/** Answers "is this the charge of X?" for a transaction automatic matching wasn't sure about. */
export function useResolveReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ transactionId, action }: { transactionId: string; action: "confirm" | "dismiss" }) =>
      api<{ charge_date?: string }>(`/api/crud/transactions/${transactionId}/subscription-review`, "POST", { action }),
    onSettled: () => Promise.all(invalidateLinks.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
    meta: { silentError: true },
  });
}

/**
 * Once per session: subscriptions that were never reconciled (created before automatic matching) get
 * their charges looked for among the existing transactions.
 */
export function useReconcileOnce(subs: Subscription[] | undefined) {
  const queryClient = useQueryClient();
  const pending = !!subs?.some((s) => s.auto_reconciled_at === null);
  useQuery({
    queryKey: ["subscriptions-reconcile-once"],
    queryFn: async () => {
      const found = await api<{ linked: number; review: number }>("/api/crud/subscriptions/reconcile", "POST");
      if (found.linked || found.review) await Promise.all(invalidateLinks.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      return found;
    },
    enabled: pending,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}

export interface ChargeCandidate {
  id: string;
  amount: number;
  date: string;
  description: string | null;
  bank_description: string | null;
  account_id: string;
  category_id: string | null;
  subcategory_id: string | null;
  account?: { name: string; color: string | null } | null;
  score: number;
  reason: "strong" | "amount" | "date" | "name" | null;
}

/** Transactions that could be a charge, best first (`all`: every account; `q`: search by description). */
export function useChargeCandidates(id: string | null, chargeDate: string | null, filters: { all: boolean; q: string }) {
  return useQuery<ChargeCandidate[]>({
    queryKey: queryKeys.subscriptions.candidates(id ?? "", chargeDate ?? "", filters),
    queryFn: () => {
      const params = new URLSearchParams({ charge: chargeDate!, ...(filters.all && { all: "1" }), ...(filters.q && { q: filters.q }) });
      return api(`/api/crud/subscriptions/${id}/candidates?${params}`);
    },
    enabled: !!id && !!chargeDate,
    placeholderData: keepPreviousData,
  });
}
