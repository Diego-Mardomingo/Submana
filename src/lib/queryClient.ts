"use client";

import { MutationCache, QueryClient } from "@tanstack/react-query";
import { apiErrorText } from "@/lib/apiErrorText";
import { currentT } from "@/lib/i18n/client";
import { toast } from "@/lib/toast";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** The caller already shows the error (inline in a form, or with its own toast): skip the global error toast. */
      silentError?: boolean;
    };
  }
}

function makeQueryClient() {
  return new QueryClient({
    // No mutation fails silently: the error toast is the default; forms with inline errors opt out with `meta: { silentError: true }`.
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.silentError) return;
        toast.error(apiErrorText(currentT(), error));
      },
    }),
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
