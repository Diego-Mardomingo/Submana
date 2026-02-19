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

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
    },
  });
}
