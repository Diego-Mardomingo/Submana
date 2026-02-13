import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";

interface CreateTransactionInput {
    amount: number;
    type: "income" | "expense";
    date: string;
    description?: string;
    account_id?: string;
    category_id?: string;
    subcategory_id?: string;
}

export function useCreateTransaction() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (newTx: CreateTransactionInput) => {
            const res = await fetch("/api/crud/create-transaction", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newTx),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to create transaction");
            }
            return res.json();
        },

        // Optimistic update: instantly add to the list
        onMutate: async (newTx) => {
            await queryClient.cancelQueries({
                queryKey: queryKeys.transactions.lists(),
            });
            const previous = queryClient.getQueryData(
                queryKeys.transactions.lists()
            );
            queryClient.setQueryData(
                queryKeys.transactions.lists(),
                (old: any[] | undefined) => {
                    const optimistic = {
                        ...newTx,
                        id: `temp-${Date.now()}`,
                        _optimistic: true,
                    };
                    return [optimistic, ...(old ?? [])];
                }
            );
            return { previous };
        },

        // Rollback on error
        onError: (_err, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(
                    queryKeys.transactions.lists(),
                    context.previous
                );
            }
        },

        // Refetch from server on settle (whether success or error)
        onSettled: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.transactions.all,
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
        },
    });
}
