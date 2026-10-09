"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  MuteTargetType,
  NotificationCounts,
  NotificationFilter,
  NotificationItem,
  NotificationMute,
  NotificationSettings,
  NotificationsPage,
} from "@/lib/notifications/types";
import type { SettingsPatch } from "@/lib/notifications/validation";
import { queryKeys } from "@/lib/queryKeys";
import { useOptimisticMutation } from "./useOptimisticMutation";

export type NotificationPages = InfiniteData<NotificationsPage, string | null>;

const PAGE_SIZE = 30;
const keys = queryKeys.notifications;

/** Inbox, newest first, 30 per page (`fetchNextPage` loads older ones). `data.pages[n].items`. */
export function useNotifications(filter: NotificationFilter, enabled = true) {
  return useInfiniteQuery({
    queryKey: keys.list(filter),
    queryFn: ({ pageParam }) =>
      api<NotificationsPage>(`/api/notifications?filter=${filter}&limit=${PAGE_SIZE}${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ""}`),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore,
    enabled,
  });
}

/** Flat list of the loaded notifications. */
export const flattenNotifications = (data: NotificationPages | undefined): NotificationItem[] => data?.pages.flatMap((page) => page.items) ?? [];

/** Unread and unseen counts (the bell rings for `unseen`; the dot/number in the menu uses `unread`). */
export function useNotificationCounts(enabled = true) {
  return useQuery({
    queryKey: keys.counts(),
    queryFn: () => api<NotificationCounts>("/api/notifications/counts"),
    enabled,
    staleTime: 60 * 1000,
  });
}

/** Removes a notification from cached inbox pages (for `useUndoableDelete` edits). */
export function removeFromNotificationPages(data: NotificationPages, id: string): NotificationPages {
  return { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.filter((item) => item.id !== id) })) };
}

// --- optimistic cache edits ------------------------------------------------------------------

function editLists(queryClient: QueryClient, edit: (items: NotificationItem[], filter: NotificationFilter) => NotificationItem[]) {
  for (const filter of ["unread", "all"] as const) {
    queryClient.setQueryData<NotificationPages>(keys.list(filter), (old) => old && { ...old, pages: old.pages.map((page) => ({ ...page, items: edit(page.items, filter) })) });
  }
}

function editCounts(queryClient: QueryClient, edit: (counts: NotificationCounts) => NotificationCounts) {
  queryClient.setQueryData<NotificationCounts>(keys.counts(), (old) => old && edit(old));
}

function findItem(queryClient: QueryClient, id: string) {
  for (const [, data] of queryClient.getQueriesData<NotificationPages>({ queryKey: keys.lists() })) {
    const item = flattenNotifications(data).find((candidate) => candidate.id === id);
    if (item) return item;
  }
  return undefined;
}

/** Mutation that edits the inbox/counts caches right away, rolls back on error and refetches once settled. */
function useInboxMutation<TVars>(options: {
  mutationFn: (vars: TVars) => Promise<unknown>;
  apply: (queryClient: QueryClient, vars: TVars) => void;
  invalidate?: QueryKey[];
}) {
  const queryClient = useQueryClient();
  const { mutationFn, apply, invalidate = [keys.lists(), keys.counts()] } = options;
  return useMutation({
    mutationFn,
    onMutate: async (vars: TVars) => {
      // Only what this mutation edits: cancelling the inbox list while it first loads (mark seen runs on
      // mount) throws its response away and leaves the list empty.
      await Promise.all(invalidate.map((queryKey) => queryClient.cancelQueries({ queryKey })));
      const previous = queryClient.getQueriesData({ queryKey: keys.all });
      apply(queryClient, vars);
      return { previous };
    },
    onError: (_error, _vars, context) => context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data)),
    onSettled: () => Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}

/** Mark one notification read or unread (`{ id, read }`). */
export function useMarkRead() {
  return useInboxMutation<{ id: string; read: boolean }>({
    mutationFn: ({ id, read }) => api(`/api/notifications/${id}`, "PATCH", { read }),
    apply: (queryClient, { id, read }) => {
      const item = findItem(queryClient, id);
      const readAt = read ? new Date().toISOString() : null;
      editLists(queryClient, (items, filter) => {
        const next = items.map((candidate) => (candidate.id === id ? { ...candidate, read_at: readAt } : candidate));
        return filter === "unread" ? next.filter((candidate) => candidate.read_at == null) : next;
      });
      if (item && (item.read_at == null) === read) {
        editCounts(queryClient, ({ unread, unseen }) => {
          const nextUnread = Math.max(0, unread + (read ? -1 : 1));
          return { unread: nextUnread, unseen: Math.min(unseen, nextUnread) };
        });
      }
    },
  });
}

export function useMarkAllRead() {
  return useInboxMutation<void>({
    mutationFn: () => api("/api/notifications/read-all", "POST"),
    apply: (queryClient) => {
      const now = new Date().toISOString();
      editLists(queryClient, (items, filter) => (filter === "unread" ? [] : items.map((item) => (item.read_at ? item : { ...item, read_at: now }))));
      editCounts(queryClient, () => ({ unread: 0, unseen: 0 }));
    },
  });
}

/** The inbox was opened: the bell stops ringing for what exists now. Notifications stay unread. */
export function useMarkSeen() {
  return useInboxMutation<void>({
    mutationFn: () => api("/api/notifications/seen", "POST"),
    apply: (queryClient) => editCounts(queryClient, (counts) => ({ ...counts, unseen: 0 })),
    invalidate: [keys.counts()],
  });
}

/**
 * Plain delete by id. The inbox wraps it with `useUndoableDelete` (edits: `removeFromNotificationPages`
 * on `keys.lists()`; commit: this endpoint), so it deliberately has no optimistic update of its own.
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/notifications/${id}`, "DELETE"),
    onSettled: () => Promise.all([queryClient.invalidateQueries({ queryKey: keys.lists() }), queryClient.invalidateQueries({ queryKey: keys.counts() })]),
  });
}

// --- settings --------------------------------------------------------------------------------

export function useNotificationSettings(enabled = true) {
  return useQuery({
    queryKey: keys.settings(),
    queryFn: () => api<NotificationSettings>("/api/notifications/settings"),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Partial update of the settings, optimistic (`mutate({ push_hide_amounts: true })`). */
export function useSaveNotificationSettings() {
  return useOptimisticMutation<SettingsPatch, NotificationSettings, NotificationSettings>({
    mutationFn: (patch) => api<NotificationSettings>("/api/notifications/settings", "PUT", patch),
    queryKey: keys.settings(),
    update: (old, patch) => ({ ...old, ...patch }),
    invalidate: [keys.settings()],
  });
}

// --- mutes -----------------------------------------------------------------------------------

export function useNotificationMutes(enabled = true) {
  return useQuery({
    queryKey: keys.mutes(),
    queryFn: () => api<NotificationMute[]>("/api/notifications/mutes"),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export const isMuted = (mutes: NotificationMute[] | undefined, type: MuteTargetType, id: string) =>
  !!mutes?.some((mute) => mute.target_type === type && mute.target_id === id);

/** Silence (`muted: true`) or unsilence a Subcount group or a joint account. */
export function useToggleMute() {
  return useOptimisticMutation<{ target_type: MuteTargetType; target_id: string; muted: boolean }, NotificationMute[]>({
    mutationFn: ({ target_type, target_id, muted }) =>
      muted
        ? api("/api/notifications/mutes", "POST", { target_type, target_id })
        : api(`/api/notifications/mutes?target_type=${target_type}&target_id=${target_id}`, "DELETE"),
    queryKey: keys.mutes(),
    update: (old, { target_type, target_id, muted }) => {
      const rest = old.filter((mute) => !(mute.target_type === target_type && mute.target_id === target_id));
      return muted ? [{ target_type, target_id, created_at: new Date().toISOString() }, ...rest] : rest;
    },
    invalidate: [keys.mutes()],
  });
}
