/**
 * QueryProvider — wraps React islands with the shared QueryClient.
 *
 * Usage in any React component that needs TanStack Query:
 *
 *   import QueryProvider from './QueryProvider';
 *   export default function MyIsland(props) {
 *     return <QueryProvider><MyIslandInner {...props} /></QueryProvider>;
 *   }
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";

export default function QueryProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
}
