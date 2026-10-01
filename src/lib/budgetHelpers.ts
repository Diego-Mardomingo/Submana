import type { SupabaseClient } from "@supabase/supabase-js";
import { detectTransferIds } from "@/lib/transferDetection";
import { calendarMonthsUtcHalfOpenRange } from "@/lib/date";

export interface CategoryRow {
  id: string;
  parent_id: string | null;
  exclude_from_metrics?: boolean;
}

const PAGE_SIZE = 1000;

/**
 * Given budget-linked category ids and full category list, returns the set of
 * category ids that count toward this budget (parent + all its subcategories when applicable).
 */
export function getEffectiveCategoryIds(
  linkedCategoryIds: string[],
  allCategories: CategoryRow[]
): string[] {
  const byParent = new Map<string, string[]>();
  const ids = new Set<string>();

  for (const c of allCategories) {
    if (c.parent_id) {
      const arr = byParent.get(c.parent_id) ?? [];
      arr.push(c.id);
      byParent.set(c.parent_id, arr);
    }
  }

  for (const catId of linkedCategoryIds) {
    ids.add(catId);
    const children = byParent.get(catId);
    if (children) {
      children.forEach((id) => ids.add(id));
    }
  }

  return Array.from(ids);
}

/** IDs of categories (and subcategories) that exclude transactions from metrics */
function getExcludedFromMetricsIds(categories: CategoryRow[]): Set<string> {
  const ids = new Set<string>();
  for (const c of categories) {
    if (c.exclude_from_metrics) ids.add(c.id);
  }
  return ids;
}

type MonthTransaction = {
  id: string;
  amount: number | string;
  type: string;
  date: string;
  account_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
};

/**
 * Transacciones del mes en APP_TIME_ZONE, paginadas. `date` es timestamptz: comparar con
 * "YYYY-MM-DD" (medianoche UTC) dejaba fuera casi todo el último día del mes.
 */
async function fetchMonthTransactions(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  month: number
): Promise<MonthTransaction[]> {
  const { startIso, endExclusiveIso } = calendarMonthsUtcHalfOpenRange(year, month, year, month);
  const rows: MonthTransaction[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id, amount, type, date, account_id, category_id, subcategory_id")
      .eq("user_id", userId)
      .gte("date", startIso)
      .lt("date", endExclusiveIso)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

/**
 * Compute total spent per budget in a given month with a single transactions query.
 * - Budget with no categories (general budget): all expenses of the month.
 * - Otherwise expenses whose category_id or subcategory_id is in the effective category set.
 * - Excludes internal transfers and transactions whose category has exclude_from_metrics.
 */
export async function computeBudgetsSpent(
  supabase: SupabaseClient,
  userId: string,
  budgets: { id: string; categoryIds: string[] }[],
  allCategories: CategoryRow[],
  year: number,
  month: number
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (budgets.length === 0) return result;

  const excludedIds = getExcludedFromMetricsIds(allCategories);
  const subToParent = new Map<string, string>();
  for (const c of allCategories) {
    if (c.parent_id) subToParent.set(c.id, c.parent_id);
  }
  const isExcluded = (catId: string | null, subId: string | null) => {
    if (catId && excludedIds.has(catId)) return true;
    if (subId) {
      if (excludedIds.has(subId)) return true;
      const parent = subToParent.get(subId);
      if (parent && excludedIds.has(parent)) return true;
    }
    return false;
  };

  const monthTxs = await fetchMonthTransactions(supabase, userId, year, month);
  const transferIds = detectTransferIds(
    monthTxs.map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      type: r.type,
      date: r.date,
      account_id: r.account_id,
    }))
  );
  const countable = monthTxs.filter(
    (r) => r.type === "expense" && !transferIds.has(r.id) && !isExcluded(r.category_id, r.subcategory_id)
  );

  for (const budget of budgets) {
    if (budget.categoryIds.length === 0) {
      result.set(budget.id, countable.reduce((sum, r) => sum + Number(r.amount), 0));
      continue;
    }
    const effective = new Set(getEffectiveCategoryIds(budget.categoryIds, allCategories));
    const total = countable
      .filter(
        (r) =>
          (r.category_id && effective.has(r.category_id)) ||
          (r.subcategory_id && effective.has(r.subcategory_id))
      )
      .reduce((sum, r) => sum + Number(r.amount), 0);
    result.set(budget.id, total);
  }
  return result;
}

/** Spent for a single budget (see computeBudgetsSpent). */
export async function computeBudgetSpent(
  supabase: SupabaseClient,
  userId: string,
  categoryIds: string[],
  allCategories: CategoryRow[],
  year: number,
  month: number
): Promise<number> {
  const spent = await computeBudgetsSpent(
    supabase,
    userId,
    [{ id: "_", categoryIds }],
    allCategories,
    year,
    month
  );
  return spent.get("_") ?? 0;
}
