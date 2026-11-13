type BreakdownTx = {
  amount: number | string;
  type: "income" | "expense";
  category_id?: string | null;
  subcategory_id?: string | null;
  category?: { name: string } | null;
  subcategory?: { name: string } | null;
};

export interface BreakdownSub {
  /** null = expenses of the category without a subcategory. */
  id: string | null;
  /** Name stored on the transaction (fallback when the category is not in the active list). */
  name?: string;
  total: number;
}

export interface BreakdownCategory {
  /** null = uncategorised expenses. */
  id: string | null;
  name?: string;
  total: number;
  /** Spent in the same category during the previous period. */
  previous: number;
  subs: BreakdownSub[];
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Expenses grouped by top-level category and subcategory, biggest first. `parentOf` maps a
 * subcategory id to its category (so rows with only a subcategory still land in their category).
 */
export function categoryBreakdown(current: BreakdownTx[], previous: BreakdownTx[], parentOf: Map<string, string>) {
  const rootOf = (tx: BreakdownTx) => tx.category_id ?? (tx.subcategory_id ? (parentOf.get(tx.subcategory_id) ?? tx.subcategory_id) : null);
  const groups = new Map<string | null, { name?: string; total: number; previous: number; subs: Map<string | null, BreakdownSub> }>();
  const group = (id: string | null) => {
    let g = groups.get(id);
    if (!g) groups.set(id, (g = { total: 0, previous: 0, subs: new Map() }));
    return g;
  };

  let total = 0;
  for (const tx of current) {
    if (tx.type !== "expense") continue;
    const amount = Number(tx.amount) || 0;
    const rootId = rootOf(tx);
    const g = group(rootId);
    g.total += amount;
    g.name ??= tx.category?.name;
    // A subcategory id that is itself the root (orphan subcategory) counts as "no subcategory".
    const subId = tx.subcategory_id && tx.subcategory_id !== rootId ? tx.subcategory_id : null;
    const sub = g.subs.get(subId) ?? { id: subId, name: subId ? tx.subcategory?.name : undefined, total: 0 };
    sub.total += amount;
    g.subs.set(subId, sub);
    total += amount;
  }

  let previousTotal = 0;
  for (const tx of previous) {
    if (tx.type !== "expense") continue;
    const amount = Number(tx.amount) || 0;
    previousTotal += amount;
    // Only categories with spending now are listed; their previous amount is just for the comparison.
    const g = groups.get(rootOf(tx));
    if (g) g.previous += amount;
  }

  const categories: BreakdownCategory[] = [...groups.entries()]
    .map(([id, g]) => ({
      id,
      name: g.name,
      total: round(g.total),
      previous: round(g.previous),
      subs: [...g.subs.values()].map((s) => ({ ...s, total: round(s.total) })).sort((a, b) => b.total - a.total),
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  return { total: round(total), previous: round(previousTotal), categories };
}

/** Change from `previous` to `current` in % (null when there is nothing to compare with). */
export function percentChange(current: number, previous: number) {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}
