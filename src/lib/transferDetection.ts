export interface TransferDetectable {
  id: string;
  amount?: number | string;
  type?: string;
  date?: string;
  account_id?: string | null;
  /** Rows linked to a shared expense or settlement are never half of an own-account transfer. */
  shared_expense_id?: string | null;
}

export interface TransferDetectionOptions {
  /**
   * Joint accounts are shared with other people, so their rows are never half of a transfer: my
   * transfer INTO a joint account has no counterpart and stays an expense of mine.
   */
  jointAccountIds?: Iterable<string>;
}

/**
 * Detects transfer pairs: an expense and an income with the same amount, different account_id
 * and timestamps within `windowHours`. Each expense is matched with at most one income
 * (greedy 1:1 by minimum time distance). Returns the ids of both sides.
 */
export function detectTransferIds(
  transactions: TransferDetectable[],
  windowHours = 48,
  options: TransferDetectionOptions = {}
): Set<string> {
  const transferIds = new Set<string>();
  const joint = new Set(options.jointAccountIds ?? []);
  const windowMs = Math.max(1, windowHours) * 60 * 60 * 1000;

  const normalized = transactions
    .map((tx) => ({
      ...tx,
      ts: new Date(tx.date ?? "").getTime(),
      cents: Math.round(Math.abs(Number(tx.amount) || 0) * 100),
      kind: (tx.type || "").toLowerCase(),
    }))
    .filter((tx) => tx.account_id && !joint.has(tx.account_id) && !tx.shared_expense_id && tx.cents > 0 && Number.isFinite(tx.ts))
    .sort((a, b) => a.ts - b.ts);

  const incomesByAmount = new Map<number, typeof normalized>();
  for (const tx of normalized) {
    if (tx.kind === "income") incomesByAmount.set(tx.cents, [...(incomesByAmount.get(tx.cents) ?? []), tx]);
  }

  for (const exp of normalized) {
    if (exp.kind !== "expense") continue;
    let best: (typeof normalized)[number] | undefined;
    for (const inc of incomesByAmount.get(exp.cents) ?? []) {
      const distance = Math.abs(inc.ts - exp.ts);
      if (transferIds.has(inc.id) || inc.account_id === exp.account_id || distance > windowMs) continue;
      if (!best || distance < Math.abs(best.ts - exp.ts)) best = inc;
    }
    if (best) {
      transferIds.add(exp.id);
      transferIds.add(best.id);
    }
  }
  return transferIds;
}
