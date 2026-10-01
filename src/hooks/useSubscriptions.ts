"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { removeById, replaceById, useOptimisticMutation } from "./useOptimisticMutation";

export interface Subscription {
  id: string;
  service_name: string;
  icon?: string | null;
  cost: number;
  start_date: string;
  end_date?: string | null;
  frequency: "weekly" | "monthly" | "yearly";
  frequency_value: number;
  account_id?: string | null;
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
}

const invalidate = [queryKeys.subscriptions.all];

export function useCreateSubscription() {
  return useOptimisticMutation({
    mutationFn: (input: SubscriptionInput & { service_name: string }) => api("/api/crud/subscriptions", "POST", input),
    invalidate,
  });
}

export function useUpdateSubscription() {
  return useOptimisticMutation({
    mutationFn: ({ id, ...input }: SubscriptionInput & { id: string }) => api(`/api/crud/subscriptions/${id}`, "PATCH", input),
    queryKey: queryKeys.subscriptions.lists(),
    update: replaceById,
    invalidate,
  });
}

export function useDeleteSubscription() {
  return useOptimisticMutation({
    mutationFn: (id: string) => api(`/api/crud/subscriptions/${id}`, "DELETE"),
    queryKey: queryKeys.subscriptions.lists(),
    update: removeById,
    invalidate,
  });
}
