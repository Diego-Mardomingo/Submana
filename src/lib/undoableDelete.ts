import { replaceEqualDeep, type QueryClient, type QueryKey } from "@tanstack/react-query";

/** Removes the deleted item from the cached data of every query under `queryKey`. */
export type CacheEdit = {
  queryKey: QueryKey;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each edit knows the shape of its own cache
  remove: (data: any) => any;
};

export type UndoableDeleteOptions = {
  queryClient: QueryClient;
  /** Hide the item from these caches while the delete is pending. */
  edits: CacheEdit[];
  /** The real delete. `keepalive` is set when the page is closing, so the request outlives it. */
  commit: (init: { keepalive: boolean }) => Promise<unknown>;
  /** Refreshed once the real delete went through (balances, budgets…). */
  invalidate: QueryKey[];
  /** The real delete failed: the item is back, tell the user. */
  onError: (error: unknown) => void;
};

export type UndoableDeleteHandle = {
  /** Brings the item back without calling the server. No-op once the delete was sent. */
  undo: () => void;
  /** Sends the delete now. Runs at most once; no-op after `undo`. */
  commit: () => Promise<void>;
};

type Entry = { commit: (keepalive: boolean) => Promise<void> };

/** Deletes waiting for their Undo toast to close. */
const pending = new Set<Entry>();
let listening = false;

/** Sends every pending delete (the page is going away: there will be no toast timeout). */
export function flushPendingDeletes() {
  return Promise.all([...pending].map((entry) => entry.commit(true))).then(() => undefined);
}

function listenForPageHide() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("pagehide", () => void flushPendingDeletes());
}

/**
 * Deferred delete: the item disappears from the caches right away but the DELETE is only sent
 * when `commit` runs (the Undo toast closed) or the page is hidden. `undo` restores the caches and
 * nothing reaches the server. Background refetches that bring the item back are hidden again
 * while the delete is pending.
 */
export function startUndoableDelete({ queryClient, edits, commit, invalidate, onError }: UndoableDeleteOptions): UndoableDeleteHandle {
  let state: "pending" | "sending" | "settled" = "pending";
  let applying = false;
  const snapshots = edits.flatMap((edit) => queryClient.getQueriesData({ queryKey: edit.queryKey }));
  const refresh = (keys: QueryKey[]) => Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  /** Puts the item back in the caches that were loaded when it was hidden, then refetches all of them. */
  const bringBack = () => {
    for (const [queryKey, data] of snapshots) queryClient.setQueryData(queryKey, data);
    return refresh(edits.map((edit) => edit.queryKey));
  };

  function hide() {
    applying = true;
    try {
      for (const edit of edits) {
        for (const query of queryClient.getQueryCache().findAll({ queryKey: edit.queryKey })) {
          const old = query.state.data;
          if (old === undefined) continue;
          const next = replaceEqualDeep(old, edit.remove(old));
          if (next !== old) queryClient.setQueryData(query.queryKey, next);
        }
      }
    } finally {
      applying = false;
    }
  }

  hide();
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (!applying && event.type === "updated" && event.action.type === "success") hide();
  });

  const entry: Entry = {
    async commit(keepalive) {
      if (state !== "pending") return;
      state = "sending";
      try {
        await commit({ keepalive });
        await refresh(invalidate);
      } catch (error) {
        unsubscribe(); // the refetch must be allowed to bring the item back
        await bringBack();
        onError(error);
      } finally {
        state = "settled";
        pending.delete(entry);
        unsubscribe();
      }
    },
  };
  pending.add(entry);
  listenForPageHide();

  return {
    commit: () => entry.commit(false),
    undo() {
      if (state !== "pending") return;
      state = "settled";
      pending.delete(entry);
      unsubscribe();
      void bringBack();
    },
  };
}
