"use client";

import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { createClient } from "@/lib/supabase/client";

/** Tables whose changes made by OTHER people must show up live, and the caches they feed. */
const WATCHED: { table: string; keys: QueryKey[] }[] = [
  { table: "friendships", keys: [queryKeys.friends.all, queryKeys.shared.all] },
  { table: "profiles", keys: [queryKeys.friends.all, queryKeys.shared.all] },
  { table: "groups", keys: [queryKeys.shared.all] },
  { table: "group_members", keys: [queryKeys.shared.all] },
  { table: "shared_expenses", keys: [queryKeys.shared.all] },
];

/** One write touches several rows (an expense plus its shares and event): refresh once. */
const DEBOUNCE_MS = 300;

/**
 * Keeps Friends and Subcount live: Supabase Realtime streams the row changes RLS lets me see and
 * the matching queries are invalidated. After a reconnect everything is refetched (events may have been missed).
 */
export function RealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const pending = new Map<string, QueryKey>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      for (const queryKey of pending.values()) queryClient.invalidateQueries({ queryKey });
      pending.clear();
    };
    const schedule = (keys: QueryKey[]) => {
      for (const key of keys) pending.set(JSON.stringify(key), key);
      clearTimeout(timer);
      timer = setTimeout(flush, DEBOUNCE_MS);
    };

    let channel = supabase.channel("live-sync");
    for (const { table, keys } of WATCHED) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, () => schedule(keys));
    }
    let subscribedOnce = false;
    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      if (subscribedOnce) schedule(WATCHED.flatMap((w) => w.keys));
      subscribedOnce = true;
    });

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}
