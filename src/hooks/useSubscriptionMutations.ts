"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

interface CreateSubscriptionInput {
  service_name: string;
  icon?: string;
  cost?: number;
  start_date?: string;
  end_date?: string | null;
  frequency?: string;
  frequency_value?: number;
  account_id?: string | null;
}

export function useCreateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSubscriptionInput) => {
      const res = await fetch("/api/crud/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to create subscription");
      return json.data;
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
    },
  });
}

interface UpdateSubscriptionInput {
  id: string;
  service_name?: string;
  icon?: string;
  cost?: number;
  start_date?: string;
  end_date?: string | null;
  frequency?: string;
  frequency_value?: number;
  account_id?: string | null;
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateSubscriptionInput) => {
      const res = await fetch(`/api/crud/subscriptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to update subscription");
      return json.data;
    },

    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.subscriptions.lists() });
      const previous = queryClient.getQueriesData({ queryKey: queryKeys.subscriptions.lists() });
      queryClient.setQueriesData(
        { queryKey: queryKeys.subscriptions.lists() },
        (old: unknown[] | undefined) =>
          ((old ?? []) as Array<{ id: string }>).map((sub) =>
            sub.id === id ? { ...sub, ...updates } : sub
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
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
    },
  });
}

export function useDeleteSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/crud/subscriptions/${id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to delete subscription");
      return json.data;
    },

    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.subscriptions.lists() });
      const previous = queryClient.getQueriesData({ queryKey: queryKeys.subscriptions.lists() });
      queryClient.setQueriesData(
        { queryKey: queryKeys.subscriptions.lists() },
        (old: unknown[] | undefined) =>
          ((old ?? []) as Array<{ id: string }>).filter((sub) => sub.id !== deletedId)
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
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
    },
  });
}
