"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

interface CreateAccountInput {
  name: string;
  balance?: number;
  icon?: string;
  color?: string;
}

export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newAccount: CreateAccountInput) => {
      const res = await fetch("/api/crud/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAccount),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to create account");
      return json.data;
    },

    onMutate: async (newAccount) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.accounts.lists() });
      const previous = queryClient.getQueryData(queryKeys.accounts.lists());
      queryClient.setQueryData(queryKeys.accounts.lists(), (old: unknown[] | undefined) => {
        const optimistic = {
          ...newAccount,
          id: `temp-${Date.now()}`,
          balance: newAccount.balance ?? 0,
          _optimistic: true,
        };
        return [...(old ?? []), optimistic];
      });
      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.accounts.lists(), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
  });
}

interface UpdateAccountInput {
  id: string;
  name: string;
  balance?: number;
  icon?: string;
  color?: string;
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (account: UpdateAccountInput) => {
      const { id, ...body } = account;
      const res = await fetch(`/api/crud/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to update account");
      return json.data;
    },

    onMutate: async (updatedAccount) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.accounts.lists() });
      const previous = queryClient.getQueryData(queryKeys.accounts.lists());
      queryClient.setQueryData(
        queryKeys.accounts.lists(),
        (old: unknown[] | undefined) =>
          ((old ?? []) as Array<{ id: string }>).map((acc) =>
            acc.id === updatedAccount.id ? { ...acc, ...updatedAccount } : acc
          )
      );
      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.accounts.lists(), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/crud/accounts/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to delete account");
      return json.data;
    },

    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.accounts.lists() });
      const previous = queryClient.getQueryData(queryKeys.accounts.lists());
      queryClient.setQueryData(
        queryKeys.accounts.lists(),
        (old: unknown[] | undefined) =>
          ((old ?? []) as Array<{ id: string }>).filter((acc) => acc.id !== deletedId)
      );
      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.accounts.lists(), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}
