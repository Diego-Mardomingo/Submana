export const queryKeys = {
  transactions: {
    all: ["transactions"] as const,
    lists: () => [...queryKeys.transactions.all, "list"] as const,
    list: (filters?: { month?: number; year?: number; accountId?: string }) =>
      [...queryKeys.transactions.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.transactions.all, "detail", id] as const,
    similar: (filters: { accountId: string; amount: number; type: string; date: string; description: string }) =>
      [...queryKeys.transactions.all, "similar", filters] as const,
  },
  accounts: {
    all: ["accounts"] as const,
    lists: () => [...queryKeys.accounts.all, "list"] as const,
    invites: () => [...queryKeys.accounts.all, "invites"] as const,
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
  profile: {
    all: ["profile"] as const,
    me: () => [...queryKeys.profile.all, "me"] as const,
    handle: (handle: string) => [...queryKeys.profile.all, "handle", handle] as const,
  },
  friends: {
    all: ["friends"] as const,
    list: () => [...queryKeys.friends.all, "list"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    lists: () => [...queryKeys.notifications.all, "list"] as const,
    list: (filter: "unread" | "all") => [...queryKeys.notifications.lists(), filter] as const,
    counts: () => [...queryKeys.notifications.all, "counts"] as const,
    settings: () => [...queryKeys.notifications.all, "settings"] as const,
    mutes: () => [...queryKeys.notifications.all, "mutes"] as const,
  },
  shared: {
    all: ["shared"] as const,
    groups: () => [...queryKeys.shared.all, "groups"] as const,
    group: (id: string) => [...queryKeys.shared.all, "group", id] as const,
    balances: () => [...queryKeys.shared.all, "balances"] as const,
  },
};
