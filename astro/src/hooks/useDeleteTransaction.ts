import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";

export function useDeleteTransaction() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch("/api/crud/delete-transaction", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to delete transaction");
            }
            return res.json();
        },

        // Optimistic removal: instantly remove from all lists
        onMutate: async (deletedId) => {
            await queryClient.cancelQueries({
                queryKey: queryKeys.transactions.lists(),
            });

            const previous = queryClient.getQueriesData({
                queryKey: queryKeys.transactions.lists()
            });

            queryClient.setQueriesData(
                { queryKey: queryKeys.transactions.lists() },
                (old: any[] | undefined) => (old ?? []).filter((tx: any) => tx.id !== deletedId)
            );

            return { previous };
        },

        // Rollback on error
        onError: (_err, _vars, context) => {
            if (context?.previous) {
                context.previous.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },

        // Refetch from server
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.transactions.all,
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
        },
    });
}
