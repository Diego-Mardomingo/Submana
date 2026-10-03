"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { normalizeHandle, validateHandle } from "@/lib/handles";
import { queryKeys } from "@/lib/queryKeys";

export interface Profile {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
}

export type PublicProfile = Profile;

/** Own profile; `data === null` once loaded means the user hasn't picked a @handle yet. */
export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile.me(),
    queryFn: () => api<Profile | null>("/api/profile"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { handle: string; display_name: string }) => api<Profile>("/api/profile", "PUT", input),
    onSuccess: (profile) => queryClient.setQueryData(queryKeys.profile.me(), profile),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.friends.all }),
  });
}

export type HandleCheck = { status: "idle" | "checking" | "available" | "error"; error?: string };

/** Debounced availability check for a handle being typed. `current` (own saved handle) is always available. */
export function useHandleAvailability(rawHandle: string, current?: string | null, delayMs = 350): HandleCheck {
  const handle = normalizeHandle(rawHandle);
  const [debounced, setDebounced] = useState(handle);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(handle), delayMs);
    return () => clearTimeout(timer);
  }, [handle, delayMs]);

  const localError = handle ? validateHandle(handle) : null;
  const isCurrent = !!current && handle === current;
  const enabled = !!debounced && debounced === handle && !localError && !isCurrent;
  const { data, isFetching } = useQuery({
    queryKey: queryKeys.profile.handle(debounced),
    queryFn: () => api<{ available: boolean; error?: string }>(`/api/profile/handle?handle=${encodeURIComponent(debounced)}`),
    enabled,
    staleTime: 30 * 1000,
  });

  if (!handle) return { status: "idle" };
  if (localError) return { status: "error", error: localError };
  if (isCurrent) return { status: "available" };
  if (!enabled || isFetching || !data) return { status: "checking" };
  return data.available ? { status: "available" } : { status: "error", error: data.error ?? "handle_taken" };
}
