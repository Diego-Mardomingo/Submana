"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { removeById, replaceById, useOptimisticMutation } from "./useOptimisticMutation";

export interface Account {
  id: string;
  name: string;
  balance: number;
  icon?: string | null;
  color?: string | null;
  is_default?: boolean;
  bank_provider?: string | null;
}

export function useAccounts() {
  return useQuery<Account[]>({
    queryKey: queryKeys.accounts.lists(),
    queryFn: () => api("/api/crud/accounts"),
    staleTime: 10 * 60 * 1000,
  });
}

interface AccountInput {
  name: string;
  balance?: number;
  icon?: string;
  color?: string;
  bank_provider?: string | null;
}

export function useCreateAccount() {
  return useOptimisticMutation({
    mutationFn: (account: AccountInput) => api("/api/crud/accounts", "POST", account),
    queryKey: queryKeys.accounts.lists(),
    update: (old, account) => [...old, { ...account, id: `temp-${Date.now()}`, balance: account.balance ?? 0, _optimistic: true }],
    invalidate: [queryKeys.accounts.all],
  });
}

export function useUpdateAccount() {
  return useOptimisticMutation({
    mutationFn: ({ id, ...account }: AccountInput & { id: string }) => api(`/api/crud/accounts/${id}`, "PATCH", account),
    queryKey: queryKeys.accounts.lists(),
    update: replaceById,
    invalidate: [queryKeys.accounts.all],
  });
}

export function useDeleteAccount() {
  return useOptimisticMutation({
    mutationFn: (id: string) => api(`/api/crud/accounts/${id}`, "DELETE"),
    queryKey: queryKeys.accounts.lists(),
    update: removeById,
    invalidate: [queryKeys.accounts.all, queryKeys.transactions.all],
  });
}

type DeleteRange = { mode: "all" } | { mode: "range"; startYear: number; startMonth: number; endYear: number; endMonth: number };

/** Deletes all (or a month range of) an account's transactions. */
export function useDeleteAccountTransactions() {
  return useOptimisticMutation({
    mutationFn: ({ accountId, payload }: { accountId: string; payload: DeleteRange }) =>
      api<{ deleted_count: number }>(`/api/crud/accounts/${accountId}/transactions`, "DELETE", payload),
    invalidate: [queryKeys.transactions.all, queryKeys.accounts.all],
  });
}
