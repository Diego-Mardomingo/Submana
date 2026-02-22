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
            const dateObj = new Date(newTx.date);
            const year = dateObj.getFullYear();
            const month = dateObj.getMonth();

            const targetKey = queryKeys.transactions.list({ year, month });

            await queryClient.cancelQueries({ queryKey: targetKey });

            const previous = queryClient.getQueryData(targetKey);

            queryClient.setQueryData(targetKey, (old: any[] | undefined) => {
                const optimistic = {
                    ...newTx,
                    id: `temp-${Date.now()}`,
                    _optimistic: true,
                };
                return [optimistic, ...(old ?? [])];
            });

            return { previous, targetKey };
        },

        // Rollback on error
        onError: (_err, _vars, context) => {
            if (context?.targetKey && context?.previous) {
                queryClient.setQueryData(
                    context.targetKey,
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
