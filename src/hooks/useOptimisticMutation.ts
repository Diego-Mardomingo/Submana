"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

/**
 * Mutation that optimistically patches every cached query under `queryKey` with `update`,
 * rolls back on error and invalidates `invalidate` once settled.
 */
export function useOptimisticMutation<TVars, TData = { id: string }[]>(options: {
  mutationFn: (vars: TVars) => Promise<unknown>;
  invalidate: QueryKey[];
  queryKey?: QueryKey;
  update?: (old: TData, vars: TVars) => TData;
}) {
  const { mutationFn, invalidate, queryKey, update } = options;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (vars: TVars) => {
      if (!queryKey || !update) return;
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueriesData<TData>({ queryKey });
      queryClient.setQueriesData<TData>({ queryKey }, (old) => (old === undefined ? old : update(old, vars)));
      return { previous };
    },
    onError: (_err, _vars, context) => context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data)),
    onSettled: () => Promise.all(invalidate.map((key) => queryClient.invalidateQueries({ queryKey: key }))),
  });
}

/** Common optimistic list updates. */
export const replaceById = <T extends { id: string }>(list: T[], { id, ...patch }: { id: string }) =>
  list.map((item) => (item.id === id ? { ...item, ...patch } : item));
export const removeById = <T extends { id: string }>(list: T[], id: string) => list.filter((item) => item.id !== id);
