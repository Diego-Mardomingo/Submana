/**
 * Global singleton QueryClient.
 *
 * In Astro, each React island mounts independently and cannot share React Context.
 * By exporting a singleton QueryClient, all islands share the same in-memory cache.
 * Each island wraps itself with <QueryClientProvider client={queryClient}>.
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 0, // Always considered stale → always refetch on mount (true SWR)
            gcTime: 1000 * 60 * 10, // 10 min — how long unused data stays in memory
            refetchOnWindowFocus: true, // Revalidate when user returns to the tab
            retry: 1,
        },
    },
});

/**
 * Hook into Astro's ClientRouter page transitions.
 * When the user navigates between pages (e.g., after a form-based mutation
 * on /subscriptions or /transactions), we invalidate all queries so
 * components on the new page refetch fresh data immediately.
 *
 * This runs only in the browser and is safe to import on the server
 * (the `typeof document` guard prevents execution during SSR).
 */
if (typeof document !== "undefined") {
    document.addEventListener("astro:page-load", () => {
        queryClient.invalidateQueries();
    });
}
