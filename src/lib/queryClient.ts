"use client";

import { QueryClient } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutos - datos frescos más tiempo
        gcTime: 30 * 60 * 1000, // 30 minutos - mantener en cache más tiempo
        refetchOnWindowFocus: false, // Evitar refetch al volver a la ventana
        retry: 1, // Solo 1 reintento en caso de error
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
