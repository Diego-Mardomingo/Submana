"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { PublicProfile } from "./useProfile";
import { useOptimisticMutation } from "./useOptimisticMutation";

/** A friendship row seen from the current user: `id` is the friendship id, `profile` the other person. */
export interface FriendItem {
  id: string;
  created_at: string;
  profile: PublicProfile;
}

export interface FriendsData {
  friends: FriendItem[];
  incoming: FriendItem[];
  outgoing: FriendItem[];
}

export function useFriends(enabled = true) {
  return useQuery({
    queryKey: queryKeys.friends.list(),
    queryFn: () => api<FriendsData>("/api/friends"),
    enabled,
  });
}

const invalidate = [queryKeys.friends.all];

export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (handle: string) => api("/api/friends", "POST", { handle }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.friends.all }),
  });
}

export function useRespondFriendRequest() {
  return useOptimisticMutation<{ id: string; accept: boolean }, FriendsData>({
    mutationFn: ({ id, accept }) => api(`/api/friends/${id}`, "PATCH", { accept }),
    queryKey: queryKeys.friends.list(),
    update: (old, { id, accept }) => {
      const request = old.incoming.find((item) => item.id === id);
      return {
        ...old,
        incoming: old.incoming.filter((item) => item.id !== id),
        friends: accept && request ? [request, ...old.friends] : old.friends,
      };
    },
    invalidate,
  });
}

/** Cancels an outgoing request or removes a friend. */
export function useDeleteFriendship() {
  return useOptimisticMutation<string, FriendsData>({
    mutationFn: (id) => api(`/api/friends/${id}`, "DELETE"),
    queryKey: queryKeys.friends.list(),
    update: (old, id) => ({
      friends: old.friends.filter((item) => item.id !== id),
      incoming: old.incoming.filter((item) => item.id !== id),
      outgoing: old.outgoing.filter((item) => item.id !== id),
    }),
    invalidate,
  });
}
