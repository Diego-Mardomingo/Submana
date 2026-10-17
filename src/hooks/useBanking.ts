"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BankConnectionView, BankLinkView, BankSyncResult, SyncMode } from "@/lib/banking/types";
import { queryKeys } from "@/lib/queryKeys";

export type { BankConnectionView, BankLinkView, SyncMode };

/** The user's bank connections (active or expired) with their account links. */
export function useBankConnections() {
  return useQuery({
    queryKey: queryKeys.banking.connections(),
    queryFn: () => api<BankConnectionView[]>("/api/banking/connections"),
    staleTime: 60 * 1000,
  });
}

/** The connection and link feeding a Submana account, if any. */
export function useAccountBankLink(accountId: string) {
  const { data, isLoading } = useBankConnections();
  for (const connection of data ?? []) {
    const link = connection.links.find((l) => l.account_id === accountId);
    if (link) return { connection, link, isLoading };
  }
  return { connection: null, link: null, isLoading };
}

/** Starts the trip to the bank: the browser leaves the app for the bank's page. */
export function useConnectBank() {
  return useMutation({
    mutationFn: async (accountId: string) => {
      const { url } = await api<{ url: string }>("/api/banking/connect", "POST", { account_id: accountId });
      window.location.assign(url);
    },
  });
}

/** Everything a sync can change: movements, balances and the connection's state. */
function useInvalidateAfterSync() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.banking.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all }),
    ]);
}

export function useSyncBank() {
  const invalidate = useInvalidateAfterSync();
  return useMutation({
    mutationFn: (connectionId: string) => api<BankSyncResult>("/api/banking/sync", "POST", { connection_id: connectionId }),
    // Also after a failure: the connection may have just expired.
    onSettled: invalidate,
  });
}

export type BankLinkInput = { id: string; account_id: string | null; sync_mode: SyncMode; sync_from: string | null };

export function useSaveBankLinks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (links: BankLinkInput[]) => api("/api/banking/links", "PATCH", { links }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.banking.all }),
  });
}

export function useDisconnectBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) => api(`/api/banking/connections/${connectionId}`, "DELETE"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.banking.all }),
  });
}

/** Merge a bank movement flagged as a possible duplicate into its manual twin, or keep both. */
export function useResolveBankReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { transactionId: string; action: "merge" | "dismiss" }) =>
      api<{ id: string }>("/api/banking/review", "POST", { transaction_id: args.transactionId, action: args.action }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
  });
}
