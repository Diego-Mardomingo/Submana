"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

async function fetchSubscriptions() {
  const res = await fetch("/api/crud/subscriptions", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch subscriptions");
  const json = await res.json();
  return json.data ?? [];
}

export function useSubscriptions() {
  return useQuery({
    queryKey: queryKeys.subscriptions.lists(),
    queryFn: fetchSubscriptions,
    staleTime: 10 * 60 * 1000, // 10 min - suscripciones cambian poco
  });
}
