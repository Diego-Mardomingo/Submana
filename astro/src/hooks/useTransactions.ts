import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";

async function fetchTransactions({ queryKey }) {
    const [_key, _list, filters] = queryKey;
    const { year, month } = filters || {};

    const params = new URLSearchParams();
    if (year !== undefined) params.append("year", year);
    if (month !== undefined) params.append("month", month);

    const res = await fetch(`/api/crud/get-all-transactions?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch transactions");
    const data = await res.json();
    return data.transactions ?? [];
}

export function useTransactions(year?: number, month?: number) {
    return useQuery({
        // If year/month are undefined, this key is effectively ['transactions', 'list', { year: undefined, month: undefined }]
        // which matches the logic we want for "all transactions"
        queryKey: queryKeys.transactions.list({ year, month }),
        queryFn: fetchTransactions,
        placeholderData: keepPreviousData,
    });
}
