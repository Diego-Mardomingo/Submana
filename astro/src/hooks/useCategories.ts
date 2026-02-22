import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";

async function fetchCategories() {
    const res = await fetch("/api/crud/get-all-categories");
    if (!res.ok) throw new Error("Failed to fetch categories");
    const data = await res.json();
    return data.categories ?? [];
}

export function useCategories() {
    return useQuery({
        queryKey: queryKeys.categories.lists(),
        queryFn: fetchCategories,
    });
}
