import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n/utils";
import { toast } from "@/lib/toast";
import { useLang } from "./useLang";
import { queryKeys } from "@/lib/queryKeys";

/** Persists a drag & drop order for accounts or budgets, updating the cached lists optimistically. */
export function useReorder<T extends { id: string }>({ table }: { table: "accounts" | "budgets" }) {
  const queryClient = useQueryClient();
  const t = useTranslations(useLang());
  const queryKey = queryKeys[table].all;

  const { mutate, isPending } = useMutation({
    mutationFn: (items: { id: string; display_order: number }[]) => api("/api/reorder", "POST", { table, items }),
    meta: { silentError: true }, // a more specific message than the global one
    onError: () => {
      toast.error(t("reorder.error"));
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleReorder = useCallback(
    (newItems: T[]) => {
      const order = new Map(newItems.map((item, index) => [item.id, index]));
      queryClient.setQueriesData<T[]>({ queryKey }, (old) =>
        old && [...old].sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity))
      );
      mutate(newItems.map((item, index) => ({ id: item.id, display_order: index })));
    },
    [queryClient, queryKey, mutate]
  );

  return { handleReorder, isReordering: isPending };
}
