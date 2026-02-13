import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";

async function fetchTransactions() {
    const res = await fetch("/api/crud/get-all-transactions");
    if (!res.ok) throw new Error("Failed to fetch transactions");
    const data = await res.json();
    return data.transactions ?? [];
}

export function useTransactions() {
    return useQuery({
        queryKey: queryKeys.transactions.lists(),
        queryFn: fetchTransactions,
    });
}
