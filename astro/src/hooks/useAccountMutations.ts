import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";

interface CreateAccountInput {
    name: string;
    balance?: number;
    icon?: string;
    color?: string;
}

export function useCreateAccount() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (newAccount: CreateAccountInput) => {
            const res = await fetch("/api/crud/create-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newAccount),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to create account");
            }
            return res.json();
        },

        onMutate: async (newAccount) => {
            await queryClient.cancelQueries({
                queryKey: queryKeys.accounts.lists(),
            });
            const previous = queryClient.getQueryData(queryKeys.accounts.lists());
            queryClient.setQueryData(
                queryKeys.accounts.lists(),
                (old: any[] | undefined) => {
                    const optimistic = {
                        ...newAccount,
                        id: `temp-${Date.now()}`,
                        balance: newAccount.balance ?? 0,
                        _optimistic: true,
                    };
                    return [...(old ?? []), optimistic];
                }
            );
            return { previous };
        },

        onError: (_err, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(
                    queryKeys.accounts.lists(),
                    context.previous
                );
            }
        },

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
        },
    });
}

interface UpdateAccountInput {
    id: string;
    name: string;
    balance?: number;
    icon?: string;
    color?: string;
}

export function useUpdateAccount() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (account: UpdateAccountInput) => {
            const res = await fetch("/api/crud/update-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(account),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to update account");
            }
            return res.json();
        },

        onMutate: async (updatedAccount) => {
            await queryClient.cancelQueries({
                queryKey: queryKeys.accounts.lists(),
            });
            const previous = queryClient.getQueryData(queryKeys.accounts.lists());
            queryClient.setQueryData(
                queryKeys.accounts.lists(),
                (old: any[] | undefined) =>
                    (old ?? []).map((acc: any) =>
                        acc.id === updatedAccount.id ? { ...acc, ...updatedAccount } : acc
                    )
            );
            return { previous };
        },

        onError: (_err, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(
                    queryKeys.accounts.lists(),
                    context.previous
                );
            }
        },

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
        },
    });
}

export function useDeleteAccount() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch("/api/crud/delete-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to delete account");
            }
            return res.json();
        },

        onMutate: async (deletedId) => {
            await queryClient.cancelQueries({
                queryKey: queryKeys.accounts.lists(),
            });
            const previous = queryClient.getQueryData(queryKeys.accounts.lists());
            queryClient.setQueryData(
                queryKeys.accounts.lists(),
                (old: any[] | undefined) =>
                    (old ?? []).filter((acc: any) => acc.id !== deletedId)
            );
            return { previous };
        },

        onError: (_err, _vars, context) => {
            if (context?.previous) {
                queryClient.setQueryData(
                    queryKeys.accounts.lists(),
                    context.previous
                );
            }
        },

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
            queryClient.invalidateQueries({
                queryKey: queryKeys.transactions.all,
            });
        },
    });
}
