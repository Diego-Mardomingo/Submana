import type { CategoryWithSubs } from "@/hooks/useCategories";
import { detectTransferIds, type TransferDetectable } from "@/lib/transferDetection";

type MetricTx = TransferDetectable & { category_id?: string | null; subcategory_id?: string | null };

/**
 * Transactions that count for metrics (dashboard, summaries, budgets): drops rows of joint accounts
 * (shared with other people, shown separately), detected transfers between own accounts and
 * categories (or parents of subcategories) flagged exclude_from_metrics.
 */
export function metricTransactions<T extends MetricTx>(
  transactions: T[],
  categories?: { defaultCategories: CategoryWithSubs[]; userCategories: CategoryWithSubs[] },
  options: { jointAccountIds?: Iterable<string> } = {}
): T[] {
  const joint = new Set(options.jointAccountIds ?? []);
  if (joint.size > 0) transactions = transactions.filter((tx) => !tx.account_id || !joint.has(tx.account_id));
  const excluded = new Set<string>();
  const parentOf = new Map<string, string>();
  for (const cat of [...(categories?.defaultCategories ?? []), ...(categories?.userCategories ?? [])]) {
    if (cat.exclude_from_metrics) excluded.add(cat.id);
    for (const sub of cat.subcategories ?? []) {
      parentOf.set(sub.id, cat.id);
      if (sub.exclude_from_metrics) excluded.add(sub.id);
    }
  }
  const transferIds = detectTransferIds(transactions, 48, { jointAccountIds: joint });
  return transactions.filter((tx) => {
    const categoryId = tx.category_id ?? (tx.subcategory_id && (parentOf.get(tx.subcategory_id) ?? tx.subcategory_id));
    return !transferIds.has(tx.id) && !(categoryId && excluded.has(categoryId));
  });
}

/** Total income and expense of a list of transactions. */
export function sumByType(transactions: { amount?: number | string; type?: string }[]) {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (tx.type === "income") income += Number(tx.amount) || 0;
    else expense += Number(tx.amount) || 0;
  }
  return { income, expense };
}

/**
 * Net effect of transactions on a balance (income adds, expense subtracts). Rebuilding historical
 * balances uses ALL transactions: transfers and excluded categories also move money.
 */
export function netBalanceChange(transactions: { amount?: number | string; type?: string }[]) {
  const { income, expense } = sumByType(transactions);
  return income - expense;
}

/** Running totals of `values` starting at `start`, rounded to cents. */
export function runningTotals(values: number[], start = 0) {
  const totals: number[] = [];
  for (const value of values) totals.push((totals.at(-1) ?? start) + value);
  return totals.map((v) => Math.round(v * 100) / 100);
}
