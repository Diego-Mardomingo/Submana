"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { BalancesData, GroupDetailData, GroupSummary } from "@/lib/shared/types";

export function useGroups(enabled = true) {
  return useQuery({
    queryKey: queryKeys.shared.groups(),
    queryFn: () => api<GroupSummary[]>("/api/shared/groups"),
    enabled,
  });
}

/** Group detail with the newest `limit` expenses. */
export function useGroup(id: string | undefined, limit = 30, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.shared.group(id ?? ""), limit],
    queryFn: () => api<GroupDetailData>(`/api/shared/groups/${id}?limit=${limit}`),
    enabled: !!id && enabled,
    placeholderData: keepPreviousData,
  });
}

/** What friends owe me / I owe them across groups (dashboard card, Subcount page). */
export function useSharedBalances(enabled = true) {
  return useQuery({
    queryKey: queryKeys.shared.balances(),
    queryFn: () => api<BalancesData>("/api/shared/balances"),
    enabled,
    staleTime: 60 * 1000,
  });
}

function useSharedMutation<TVars, TData = unknown>(mutationFn: (vars: TVars) => Promise<TData>, silentError = false) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    meta: { silentError },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.shared.all }),
  });
}

export function useCreateGroup() {
  // The form shows the error inline.
  return useSharedMutation((input: { name: string; member_ids: string[] }) => api<{ id: string }>("/api/shared/groups", "POST", input), true);
}

/** `silentError`: the caller shows the error itself (renaming shows it inline). */
export function useUpdateGroup({ silentError = false } = {}) {
  return useSharedMutation(
    ({ id, ...patch }: { id: string; name?: string; archived?: boolean }) => api(`/api/shared/groups/${id}`, "PATCH", patch),
    silentError
  );
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/shared/groups/${id}`, "DELETE"),
    // Not awaited: the caller leaves the group page before its query refetches into "not found".
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shared.all });
    },
  });
}

export function useAddGroupMember() {
  return useSharedMutation(({ groupId, userId }: { groupId: string; userId: string }) =>
    api(`/api/shared/groups/${groupId}/members`, "POST", { user_id: userId })
  );
}

export function useRemoveGroupMember() {
  return useSharedMutation(({ groupId, userId }: { groupId: string; userId: string }) =>
    api(`/api/shared/groups/${groupId}/members/${userId}`, "DELETE")
  );
}
