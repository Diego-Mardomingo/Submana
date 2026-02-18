import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";

async function fetchSubscriptions() {
    const res = await fetch("/api/crud/get-all-subs");
    if (!res.ok) throw new Error("Failed to fetch subscriptions");
    const data = await res.json();
    return data.subscriptions ?? [];
}

export function useSubscriptions() {
    return useQuery({
        queryKey: queryKeys.subscriptions.lists(),
        queryFn: fetchSubscriptions,
    });
}
