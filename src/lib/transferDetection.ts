export interface TransferDetectable {
  id: string;
  amount: number;
  type: string;
  date: string;
  account_id?: string | null;
}

/**
 * Detects transfer pairs: an expense and an income with the same amount,
 * same date, and different account_id are considered a transfer.
 * Returns a Set of transaction IDs that belong to detected transfers.
 * Each expense is matched with at most one income (greedy 1:1).
 */
export function detectTransferIds(transactions: TransferDetectable[]): Set<string> {
  const transferIds = new Set<string>();

  const expenses = transactions.filter((tx) => tx.type === "expense" && tx.account_id);
  const incomes = transactions.filter((tx) => tx.type === "income" && tx.account_id);

  const usedIncomeIds = new Set<string>();

  for (const exp of expenses) {
    for (const inc of incomes) {
      if (usedIncomeIds.has(inc.id)) continue;
      if (
        inc.amount === exp.amount &&
        inc.date === exp.date &&
        inc.account_id !== exp.account_id
      ) {
        transferIds.add(exp.id);
        transferIds.add(inc.id);
        usedIncomeIds.add(inc.id);
        break;
      }
    }
  }

  return transferIds;
}
