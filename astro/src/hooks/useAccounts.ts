import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";

async function fetchAccounts() {
    const res = await fetch("/api/crud/get-all-accounts");
    if (!res.ok) throw new Error("Failed to fetch accounts");
    const data = await res.json();
    return data.accounts ?? [];
}

export function useAccounts() {
    return useQuery({
        queryKey: queryKeys.accounts.lists(),
        queryFn: fetchAccounts,
    });
}
