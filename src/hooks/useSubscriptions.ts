"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
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
}

const invalidate = [queryKeys.subscriptions.all];

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
