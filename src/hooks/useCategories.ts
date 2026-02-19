"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

async function fetchCategories() {
  const res = await fetch("/api/crud/categories");
  if (!res.ok) throw new Error("Failed to fetch categories");
  const json = await res.json();
  return json.data ?? [];
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.lists(),
    queryFn: fetchCategories,
  });
}
