export const queryKeys = {
  transactions: {
    all: ["transactions"] as const,
    lists: () => [...queryKeys.transactions.all, "list"] as const,
    list: (filters?: { month?: number; year?: number; accountId?: string }) =>
      [...queryKeys.transactions.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.transactions.all, "detail", id] as const,
  },
  accounts: {
    all: ["accounts"] as const,
    lists: () => [...queryKeys.accounts.all, "list"] as const,
  },
  subscriptions: {
    all: ["subscriptions"] as const,
    lists: () => [...queryKeys.subscriptions.all, "list"] as const,
  },
  categories: {
    all: ["categories"] as const,
    list: (filters: { archived: boolean }) => [...queryKeys.categories.all, "list", filters] as const,
  },
  budgets: {
    all: ["budgets"] as const,
    lists: () => [...queryKeys.budgets.all, "list"] as const,
    list: (filters?: { month?: string }) => [...queryKeys.budgets.lists(), filters] as const,
  },
};
