/**
 * Budget warning thresholds (pure: used by the browser toast and by the server notifications).
 * A budget warns at 80 % and at 100 % of its limit.
 */

export const BUDGET_THRESHOLDS = [0.8, 1] as const;

/** Tolerance for sums of euros that land a hair under the limit (e.g. 0.1 + 0.2). */
const EPSILON = 1e-9;

/** Share of the limit already spent (0 when the budget has no limit). */
export const budgetRatio = (spent: number, limit: number) => (Number(limit) > 0 ? Number(spent || 0) / Number(limit) : 0);

/** Thresholds crossed when the spent share goes from `before` to `after` (under it before, at or over it after). */
export function crossedThresholds(before: number, after: number, thresholds: readonly number[] = BUDGET_THRESHOLDS): number[] {
  return thresholds.filter((t) => before < t - EPSILON && after >= t - EPSILON);
}

/** The highest threshold the share has reached, or null when it is under all of them. */
export function reachedThreshold(ratio: number, thresholds: readonly number[] = BUDGET_THRESHOLDS): number | null {
  const reached = thresholds.filter((t) => ratio >= t - EPSILON);
  return reached.length ? Math.max(...reached) : null;
}

/** A budget that crossed a threshold; what the import responses hand to the client toast. */
export interface CrossedBudget {
  id: string;
  /** Budget label (its categories) in the user's language; empty for the general budget. */
  name: string;
  /** Spent share rounded to a whole percent. */
  pct: number;
  /** The threshold crossed, as a percent (80 or 100). */
  threshold: number;
  /** YYYY-MM the amounts belong to. */
  month: string;
}

/** Joins the lists of several responses (main account, savings pocket), keeping the highest crossing of each budget and month. */
export function mergeCrossedBudgets(...lists: (CrossedBudget[] | undefined)[]): CrossedBudget[] {
  const byBudget = new Map<string, CrossedBudget>();
  for (const item of lists.flatMap((list) => list ?? [])) {
    const key = `${item.id}:${item.month}`;
    const current = byBudget.get(key);
    if (!current || item.pct > current.pct) byBudget.set(key, item);
  }
  return [...byBudget.values()];
}
