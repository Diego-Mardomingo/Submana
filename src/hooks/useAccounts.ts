"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccountRole } from "@/lib/accountAccess";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { PublicProfile } from "./useProfile";
import { removeById, replaceById, useOptimisticMutation } from "./useOptimisticMutation";

export interface Account {
  id: string;
  name: string;
  balance: number;
  icon?: string | null;
  color?: string | null;
  is_default?: boolean;
  bank_provider?: string | null;
  /** Shared with other people (a real bank account seen by 2+ members). */
  is_joint?: boolean;
  /** My role in the account: owner of my own accounts, member of someone else's joint account. */
  my_role?: AccountRole;
  members?: AccountMember[];
}

export interface AccountMember {
  user_id: string;
  role: AccountRole;
  status: "pending" | "accepted";
  profile: PublicProfile | null;
}

const NO_IDS: ReadonlySet<string> = new Set();

/** Ids of the joint accounts I belong to: their rows never count in personal metrics or budgets. */
export function useJointAccountIds(): ReadonlySet<string> {
  const { data } = useAccounts();
  return useMemo(() => {
    const ids = (data ?? []).filter((account) => account.is_joint).map((account) => account.id);
    return ids.length ? new Set(ids) : NO_IDS;
  }, [data]);
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
    meta: { silentError: true }, // the sheet shows the error inline
  });
}

export function useUpdateAccount() {
  return useOptimisticMutation({
    mutationFn: ({ id, ...account }: AccountInput & { id: string }) => api(`/api/crud/accounts/${id}`, "PATCH", account),
    queryKey: queryKeys.accounts.lists(),
    update: replaceById,
    invalidate: [queryKeys.accounts.all],
    meta: { silentError: true },
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
    meta: { silentError: true }, // the sheet shows the error inline
  });
}

/** A pending invitation to join someone else's joint account. */
export interface AccountInvite {
  account_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  invited_at: string;
  owner: PublicProfile | null;
}

export function useAccountInvites() {
  return useQuery<AccountInvite[]>({
    queryKey: queryKeys.accounts.invites(),
    queryFn: () => api("/api/accounts/invites"),
  });
}

function useInvalidateAccounts() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.all }),
    ]);
}

/** Owner invites a friend to the joint account. */
export function useInviteAccountMember() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: ({ accountId, friendId }: { accountId: string; friendId: string }) =>
      api(`/api/accounts/${accountId}/members`, "POST", { friend_id: friendId }),
    onSettled: invalidate,
  });
}

/** Accepts or declines an invitation. */
export function useRespondAccountInvite() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: ({ accountId, accept }: { accountId: string; accept: boolean }) =>
      api(`/api/accounts/${accountId}/members`, "PATCH", { accept }),
    onSettled: invalidate,
  });
}

/** Owner removes a member / cancels an invitation, or a member leaves (userId = me). */
export function useRemoveAccountMember() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: ({ accountId, userId }: { accountId: string; userId: string }) => api(`/api/accounts/${accountId}/members/${userId}`, "DELETE"),
    onSettled: invalidate,
  });
}
