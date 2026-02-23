export const queryKeys = {
  transactions: {
    all: ["transactions"] as const,
    lists: () => [...queryKeys.transactions.all, "list"] as const,
    list: (filters?: { month?: number; year?: number; accountId?: string }) =>
      [...queryKeys.transactions.lists(), filters] as const,
    detail: (id: string) =>
      [...queryKeys.transactions.all, "detail", id] as const,
  },

  accounts: {
    all: ["accounts"] as const,
    lists: () => [...queryKeys.accounts.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.accounts.lists(), filters] as const,
  },

  subscriptions: {
    all: ["subscriptions"] as const,
    lists: () => [...queryKeys.subscriptions.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.subscriptions.lists(), filters] as const,
  },

  categories: {
    all: ["categories"] as const,
    lists: () => [...queryKeys.categories.all, "list"] as const,
    list: (filters?: { type?: string; archived?: boolean }) =>
      [...queryKeys.categories.lists(), filters] as const,
  },
} as const;
