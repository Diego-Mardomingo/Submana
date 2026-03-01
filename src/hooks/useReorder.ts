import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCallback } from "react";
import { queryKeys } from "@/lib/queryKeys";

type ReorderableTable = "accounts" | "budgets";

interface ReorderItem {
  id: string;
  display_order: number;
}

interface UseReorderOptions {
  table: ReorderableTable;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

async function reorderItems(table: ReorderableTable, items: ReorderItem[]) {
  const res = await fetch("/api/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table, items }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Error al reordenar");
  }

  return res.json();
}

function getInvalidateKey(table: ReorderableTable) {
  if (table === "accounts") {
    return queryKeys.accounts.all;
  }
  return queryKeys.budgets.all;
}

export function useReorder<T extends { id: string }>({ table, onSuccess, onError }: UseReorderOptions) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (items: ReorderItem[]) => reorderItems(table, items),
    onError: (error: Error) => {
      toast.error("Error al reordenar");
      queryClient.invalidateQueries({ queryKey: getInvalidateKey(table) });
      onError?.(error);
    },
    onSuccess: () => {
      onSuccess?.();
    },
  });

  const handleReorder = useCallback(
    (newItems: T[]) => {
      const items: ReorderItem[] = newItems.map((item, index) => ({
        id: item.id,
        display_order: index,
      }));

      // Actualización optimista: actualiza todas las queries que coincidan con el prefijo
      const queryKey = getInvalidateKey(table);
      queryClient.setQueriesData<T[]>(
        { queryKey },
        (oldData) => {
          if (!oldData) return oldData;
          // Crear un mapa de id -> nuevo orden
          const orderMap = new Map(newItems.map((item, idx) => [item.id, idx]));
          // Reordenar los datos existentes según el nuevo orden
          return [...oldData].sort((a, b) => {
            const orderA = orderMap.get(a.id) ?? Infinity;
            const orderB = orderMap.get(b.id) ?? Infinity;
            return orderA - orderB;
          });
        }
      );

      mutation.mutate(items);
    },
    [queryClient, table, mutation]
  );

  return {
    handleReorder,
    isReordering: mutation.isPending,
    error: mutation.error,
  };
}
