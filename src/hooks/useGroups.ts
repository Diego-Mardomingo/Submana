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

/** What friends owe me / I owe them across groups (dashboard card, groups page). */
export function useSharedBalances(enabled = true) {
  return useQuery({
    queryKey: queryKeys.shared.balances(),
    queryFn: () => api<BalancesData>("/api/shared/balances"),
    enabled,
    staleTime: 60 * 1000,
  });
}

function useSharedMutation<TVars, TData = unknown>(mutationFn: (vars: TVars) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.shared.all }),
  });
}

export function useCreateGroup() {
  return useSharedMutation((input: { name: string; member_ids: string[] }) => api<{ id: string }>("/api/shared/groups", "POST", input));
}

/** Opens (creating it if needed) the implicit 1:1 group with a friend. */
export function useOpenDirectGroup() {
  return useSharedMutation((friendId: string) => api<{ id: string }>("/api/shared/direct", "POST", { friend_id: friendId }));
}

export function useUpdateGroup() {
  return useSharedMutation(({ id, ...patch }: { id: string; name?: string; archived?: boolean }) =>
    api(`/api/shared/groups/${id}`, "PATCH", patch)
  );
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
