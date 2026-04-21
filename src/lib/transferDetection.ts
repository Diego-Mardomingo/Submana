export interface TransferDetectable {
  id: string;
  amount: number;
  type: string;
  date: string;
  account_id?: string | null;
}

interface DetectTransferOptions {
  windowHours?: number;
}

/**
 * Detects transfer pairs: an expense and an income with the same amount,
 * different account_id, and close timestamp (windowHours) are considered a transfer.
 * Returns a Set of transaction IDs that belong to detected transfers.
 * Each expense is matched with at most one income (greedy 1:1 by minimum time distance).
 */
export function detectTransferIds(
  transactions: TransferDetectable[],
  options?: DetectTransferOptions
): Set<string> {
  const transferIds = new Set<string>();
  const windowMs = Math.max(1, options?.windowHours ?? 48) * 60 * 60 * 1000;

  const normalized = transactions
    .map((tx) => {
      const ts = new Date(tx.date).getTime();
      return {
        ...tx,
        ts,
        cents: Math.round(Math.abs(Number(tx.amount) || 0) * 100),
        normalizedType: (tx.type || "").toLowerCase(),
      };
    })
    .filter(
      (tx) =>
        !!tx.account_id &&
        tx.cents > 0 &&
        Number.isFinite(tx.ts) &&
        (tx.normalizedType === "expense" || tx.normalizedType === "income")
    );

  const expenses = normalized.filter((tx) => tx.normalizedType === "expense");
  const incomesByAmount = new Map<number, typeof normalized>();
  for (const tx of normalized) {
    if (tx.normalizedType !== "income") continue;
    const list = incomesByAmount.get(tx.cents) ?? [];
    list.push(tx);
    incomesByAmount.set(tx.cents, list);
  }
  for (const incomes of incomesByAmount.values()) {
    incomes.sort((a, b) => a.ts - b.ts);
  }

  expenses.sort((a, b) => a.ts - b.ts);
  const usedIncomeIds = new Set<string>();

  for (const exp of expenses) {
    const candidateIncomes = incomesByAmount.get(exp.cents) ?? [];
    let bestCandidate: (typeof candidateIncomes)[number] | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const inc of candidateIncomes) {
      if (usedIncomeIds.has(inc.id)) continue;
      if (inc.account_id === exp.account_id) continue;
      const distance = Math.abs(inc.ts - exp.ts);
      if (distance > windowMs) continue;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCandidate = inc;
      }
    }

    if (bestCandidate) {
      transferIds.add(exp.id);
      transferIds.add(bestCandidate.id);
      usedIncomeIds.add(bestCandidate.id);
    }
  }

  return transferIds;
}
