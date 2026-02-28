"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

async function fetchAccounts() {
  const res = await fetch("/api/crud/accounts", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch accounts");
  const json = await res.json();
  return json.data ?? [];
}

export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts.lists(),
    queryFn: fetchAccounts,
    staleTime: 10 * 60 * 1000, // 10 min - cuentas cambian poco
  });
}
