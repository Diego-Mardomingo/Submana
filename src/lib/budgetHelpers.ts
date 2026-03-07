import type { SupabaseClient } from "@supabase/supabase-js";
import { detectTransferIds } from "@/lib/transferDetection";

export interface CategoryRow {
  id: string;
  parent_id: string | null;
  exclude_from_metrics?: boolean;
}

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

/**
 * Returns start and end of month as YYYY-MM-DD strings for the given year/month (1-indexed).
 * Uses date strings instead of ISO to avoid timezone conversion issues.
 */
export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const lastDay = new Date(year, month, 0).getDate();
  const monthStr = String(month).padStart(2, "0");
  return {
    start: `${year}-${monthStr}-01`,
    end: `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** IDs of categories (and subcategories) that exclude transactions from metrics */
function getExcludedFromMetricsIds(categories: CategoryRow[]): Set<string> {
  const ids = new Set<string>();
  for (const c of categories) {
    if (c.exclude_from_metrics) ids.add(c.id);
  }
  return ids;
}

/**
 * Compute total spent for a budget in a given month.
 * - If categoryIds is empty (general budget), sum all expenses for the user in the month.
 * - Otherwise sum expenses where category_id or subcategory_id is in the effective category set.
 * - Excludes transactions whose category has exclude_from_metrics.
 */
export async function computeBudgetSpent(
  supabase: SupabaseClient,
  userId: string,
  categoryIds: string[],
  allCategories: CategoryRow[],
  year: number,
  month: number
): Promise<number> {
  const { start, end } = getMonthRange(year, month);
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

  const { data: allExpenses } = await supabase
    .from("transactions")
    .select("id, amount, date, account_id, category_id, subcategory_id")
    .eq("user_id", userId)
    .eq("type", "expense")
    .gte("date", start)
    .lte("date", end);

  const { data: allIncomes } = await supabase
    .from("transactions")
    .select("id, amount, date, account_id")
    .eq("user_id", userId)
    .eq("type", "income")
    .gte("date", start)
    .lte("date", end);

  const combined = [
    ...(allExpenses ?? []).map((r) => ({ id: r.id, amount: Number(r.amount), type: "expense", date: r.date, account_id: r.account_id })),
    ...(allIncomes ?? []).map((r) => ({ id: r.id, amount: Number(r.amount), type: "income", date: r.date, account_id: r.account_id })),
  ];
  const transferIds = detectTransferIds(combined);

  if (categoryIds.length === 0) {
    const total = (allExpenses ?? [])
      .filter((row) => !transferIds.has(row.id) && !isExcluded(row.category_id ?? null, row.subcategory_id ?? null))
      .reduce((sum, row) => sum + Number(row.amount), 0);
    return total;
  }

  const effectiveIds = getEffectiveCategoryIds(categoryIds, allCategories);
  if (effectiveIds.length === 0) return 0;

  const { data } = await supabase
    .from("transactions")
    .select("id, amount, category_id, subcategory_id")
    .eq("user_id", userId)
    .eq("type", "expense")
    .gte("date", start)
    .lte("date", end)
    .or(`category_id.in.(${effectiveIds.join(",")}),subcategory_id.in.(${effectiveIds.join(",")})`);

  const total = (data ?? [])
    .filter((row) => !transferIds.has(row.id) && !isExcluded(row.category_id ?? null, row.subcategory_id ?? null))
    .reduce((sum, row) => sum + Number(row.amount), 0);
  return total;
}
