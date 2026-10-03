export interface Transfer {
  from: string;
  to: string;
  cents: number;
}

export interface ExpenseForBalance {
  paidBy: string;
  totalCents: number;
  shares: { userId: string; cents: number }[];
}

/** Net balance per user in cents: paid - owed (positive = the group owes them). Settlements are expenses too. */
export function groupNetBalances(expenses: ExpenseForBalance[]): Map<string, number> {
  const nets = new Map<string, number>();
  const add = (id: string, cents: number) => nets.set(id, (nets.get(id) ?? 0) + cents);
  for (const e of expenses) {
    add(e.paidBy, e.totalCents);
    for (const s of e.shares) add(s.userId, -s.cents);
  }
  return nets;
}

type Nets = Map<string, number> | Record<string, number>;

const entries = (nets: Nets): [string, number][] => (nets instanceof Map ? [...nets] : Object.entries(nets));

/**
 * Who pays whom: greedily matches the largest creditor with the largest debtor, so at most n-1
 * transfers settle the whole group. Ties break by id (deterministic).
 */
export function simplifyDebts(nets: Nets): Transfer[] {
  type Side = { id: string; c: number };
  const bySize = (a: Side, b: Side) => b.c - a.c || (a.id < b.id ? -1 : 1);
  const creditors: Side[] = entries(nets).filter(([, c]) => c > 0).map(([id, c]) => ({ id, c }));
  const debtors: Side[] = entries(nets).filter(([, c]) => c < 0).map(([id, c]) => ({ id, c: -c }));

  const transfers: Transfer[] = [];
  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort(bySize);
    debtors.sort(bySize);
    const creditor = creditors[0]!;
    const debtor = debtors[0]!;
    const cents = Math.min(creditor.c, debtor.c);
    transfers.push({ from: debtor.id, to: creditor.id, cents });
    creditor.c -= cents;
    debtor.c -= cents;
    if (creditor.c === 0) creditors.shift();
    if (debtor.c === 0) debtors.shift();
  }
  return transfers;
}

export interface FriendTotals {
  /** Per friend: positive = they owe me, negative = I owe them (cents), only non-zero. */
  perFriend: Map<string, number>;
  owedToMe: number;
  iOwe: number;
}

/** My position against each person across groups, from the simplified transfers of each group. */
export function friendTotals(me: string, groups: { nets: Nets }[]): FriendTotals {
  const perFriend = new Map<string, number>();
  for (const group of groups) {
    for (const t of simplifyDebts(group.nets)) {
      if (t.to === me) perFriend.set(t.from, (perFriend.get(t.from) ?? 0) + t.cents);
      else if (t.from === me) perFriend.set(t.to, (perFriend.get(t.to) ?? 0) - t.cents);
    }
  }
  let owedToMe = 0;
  let iOwe = 0;
  for (const [id, cents] of [...perFriend]) {
    if (cents === 0) perFriend.delete(id);
    else if (cents > 0) owedToMe += cents;
    else iOwe += -cents;
  }
  return { perFriend, owedToMe, iOwe };
}
