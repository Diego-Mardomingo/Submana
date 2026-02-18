# Submana Architecture Guidelines

> **For AI Assistants & Developers**: This document defines the canonical data fetching, caching, and mutation patterns for Submana. Follow these patterns exactly when implementing new features.

---

## Tech Stack

- **Framework**: Astro 5 (SSR mode) + React 19 islands
- **State Management**: TanStack Query v5 (client-side)
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Netlify
- **Styling**: Tailwind CSS v4

---

## Data Fetching Architecture

### Core Principle: Stale-While-Revalidate (SWR)

**Every data fetch must use TanStack Query hooks.** The pattern:

1. **Show cached data instantly** (if available)
2. **Refetch in background** on every component mount
3. **Update UI when fresh data arrives**

### Singleton QueryClient

**Location**: `src/lib/queryClient.ts`

```typescript
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,                // Always refetch (true SWR)
      gcTime: 1000 * 60 * 10,      // Cache persists 10min in memory
      refetchOnWindowFocus: true,   // Revalidate on tab focus
      retry: 1,
    },
  },
});
```

**Why singleton?** Astro islands don't share React Context. A singleton ensures all islands share the same cache.

### Astro Navigation Integration

**Critical**: `queryClient.ts` hooks into Astro's ClientRouter:

```typescript
if (typeof document !== "undefined") {
  document.addEventListener("astro:page-load", () => {
    queryClient.invalidateQueries();
  });
}
```

This ensures navigating between pages (e.g., after form mutations) triggers immediate refetch.

---

## Query Keys: Hierarchical Structure

**Location**: `src/lib/queryKeys.ts`

**Pattern**:
```typescript
export const queryKeys = {
  transactions: {
    all:    ['transactions'] as const,
    lists:  () => [...queryKeys.transactions.all, 'list'] as const,
    list:   (filters?: { month?: number; year?: number }) =>
              [...queryKeys.transactions.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.transactions.all, 'detail', id] as const,
  },
  // ... same for accounts, subscriptions, categories
};
```

**Invalidation hierarchy**:
- `invalidateQueries({ queryKey: queryKeys.transactions.all })` → invalidates all transaction queries
- `invalidateQueries({ queryKey: queryKeys.transactions.lists() })` → invalidates only lists (not details)

---

## Creating a New Query Hook

**Example**: `src/hooks/useTransactions.ts`

```typescript
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";

async function fetchTransactions() {
  const res = await fetch("/api/crud/get-all-transactions");
  if (!res.ok) throw new Error("Failed to fetch transactions");
  const data = await res.json();
  return data.transactions ?? [];
}

export function useTransactions() {
  return useQuery({
    queryKey: queryKeys.transactions.lists(),
    queryFn: fetchTransactions,
  });
}
```

**Usage in a React island**:
```tsx
import QueryProvider from './QueryProvider';
import { useTransactions } from '../hooks/useTransactions';

function TransactionList() {
  const { data: transactions = [], isLoading } = useTransactions();
  // ... render logic
}

export default function TransactionListIsland(props) {
  return (
    <QueryProvider>
      <TransactionList {...props} />
    </QueryProvider>
  );
}
```

---

## Creating a Mutation Hook with Optimistic UI

**Example**: `src/hooks/useCreateTransaction.ts`

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newTx) => {
      const res = await fetch("/api/crud/create-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTx),
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },

    // 🟢 OPTIMISTIC UPDATE: Add to cache immediately
    onMutate: async (newTx) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.transactions.lists() });
      const previous = queryClient.getQueryData(queryKeys.transactions.lists());
      
      queryClient.setQueryData(queryKeys.transactions.lists(), (old = []) => {
        const optimistic = { ...newTx, id: `temp-${Date.now()}`, _optimistic: true };
        return [optimistic, ...old];
      });
      
      return { previous }; // Rollback context
    },

    // 🔴 ROLLBACK: Restore old data on error
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.transactions.lists(), context.previous);
      }
    },

    // 🔵 INVALIDATE: Refetch from server after mutation settles
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all }); // Balance changed
    },
  });
}
```

**Usage**:
```tsx
const createTx = useCreateTransaction();

const handleSubmit = async (formData) => {
  try {
    await createTx.mutateAsync(formData);
    // UI already updated optimistically
  } catch (error) {
    // UI already rolled back
    showError(error.message);
  }
};
```

---

## API Route Dual Format (JSON + FormData)

**All mutation API routes must support both JSON (for `fetch()`) and FormData (for legacy forms).**

**Helper**: `src/lib/apiHelpers.ts`

```typescript
export async function parseRequestBody(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  
  if (contentType.includes("application/json")) {
    const json = await request.json();
    const body = {};
    for (const [key, value] of Object.entries(json)) {
      body[key] = value != null ? String(value) : "";
    }
    return { body, isJson: true };
  }
  
  const formData = await request.formData();
  const body = {};
  for (const [key, value] of formData.entries()) {
    body[key] = value.toString();
  }
  return { body, isJson: false };
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
```

**API route template**:
```typescript
import { parseRequestBody, jsonResponse, jsonError } from "../../../lib/apiHelpers";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // ... auth logic ...
  
  const { body, isJson } = await parseRequestBody(request);
  
  // ... validation ...
  
  const { data, error } = await supabase.from("table").insert(body).select().single();
  
  if (error) {
    if (isJson) return jsonError(error.message, 500);
    return redirect(`/page?error=${error.message}`);
  }
  
  if (isJson) return jsonResponse({ success: true, data });
  return redirect("/page?success=created");
};
```

---

## Cross-Entity Cache Invalidation

**When a mutation affects multiple entities, invalidate all affected caches.**

Examples:
- Creating a transaction → invalidate `transactions.all` **and** `accounts.all` (balance changed)
- Deleting an account → invalidate `accounts.all` **and** `transactions.all` (orphaned transactions)
- Setting default account → invalidate `accounts.all` only

**Pattern**:
```typescript
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
}
```

---

## Supabase Realtime (Cross-Tab/Device Sync)

**When to use**: When users might have multiple tabs/devices open and expect instant sync.

**Pattern**: `src/hooks/useRealtimeSync.ts`

```typescript
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabaseClient } from "../lib/supabaseClient";
import { queryKeys } from "../lib/queryKeys";

export function useRealtimeSync(table: string, queryKey: any[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabaseClient
      .channel(`public:${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [table, queryClient]);
}
```

**Usage**:
```tsx
function TransactionList() {
  const { data: transactions = [] } = useTransactions();
  useRealtimeSync("transactions", queryKeys.transactions.all);
  // Now syncs across tabs/devices
}
```

---

## Performance: Prefetching

**For common navigation paths, prefetch data on hover/focus.**

```typescript
import { queryClient } from "../lib/queryClient";
import { queryKeys } from "../lib/queryKeys";

async function fetchTransactions() {
  const res = await fetch("/api/crud/get-all-transactions");
  return res.json().then(d => d.transactions ?? []);
}

// In navigation component
<a 
  href="/transactions"
  onMouseEnter={() => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.transactions.lists(),
      queryFn: fetchTransactions,
    });
  }}
>
  Transactions
</a>
```

---

## Testing Checklist for New Features

When implementing data mutations, verify:

- [ ] **Optimistic UI**: Change appears instantly in UI
- [ ] **Rollback**: On error, UI reverts to previous state
- [ ] **Cache invalidation**: Affected entities refetch automatically
- [ ] **Cross-tab sync** (if Realtime enabled): Open 2 tabs → mutation in tab A → instant update in tab B
- [ ] **Form compatibility**: Traditional form submission still works (redirect flow)
- [ ] **JSON API**: `fetch()` call with JSON body works (returns JSON response)

---

## Common Pitfalls

1. **Don't use `useEffect` + `fetch` directly** → Always use TanStack Query hooks
2. **Don't forget to wrap islands in `<QueryProvider>`** → Cache won't work
3. **Don't set `staleTime > 0` for individual queries** → Breaks global SWR behavior
4. **Don't skip `onSettled` invalidation** → Stale data will persist
5. **Don't invalidate only the mutated entity** → Related entities won't update (e.g., account balance after transaction)

---

## File Structure Reference

```
src/
├── lib/
│   ├── queryClient.ts          # Singleton QueryClient + navigation hook
│   ├── queryKeys.ts             # Hierarchical cache keys
│   └── apiHelpers.ts            # Dual JSON/FormData parser
├── hooks/
│   ├── useTransactions.ts       # Query hook
│   ├── useAccounts.ts           # Query hook
│   ├── useCreateTransaction.ts  # Mutation hook
│   ├── useDeleteTransaction.ts  # Mutation hook
│   ├── useAccountMutations.ts   # create/update/delete accounts
│   └── useRealtimeSync.ts       # (optional) Realtime sync
├── components/
│   └── QueryProvider.tsx        # Wrapper for React islands
└── pages/api/crud/
    ├── create-transaction.ts    # Dual JSON/FormData
    ├── update-transaction.ts    # Dual JSON/FormData
    └── ...
```

---

**Last Updated**: 2026-02-13  
**Maintainer**: AI Architecture Assistant
