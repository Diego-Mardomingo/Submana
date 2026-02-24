import type { SupabaseClient } from "@supabase/supabase-js";

export interface CategoryRow {
  id: string;
  parent_id: string | null;
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
 * Returns start and end of month in ISO string for the given year/month (1-indexed).
 */
export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * Compute total spent for a budget in a given month.
 * - If categoryIds is empty (general budget), sum all expenses for the user in the month.
 * - Otherwise sum expenses where category_id or subcategory_id is in the effective category set.
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

  if (categoryIds.length === 0) {
    const { data } = await supabase
      .from("transactions")
      .select("amount")
      .eq("user_id", userId)
      .eq("type", "expense")
      .gte("date", start)
      .lte("date", end);
    const total = (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
    return total;
  }

  const effectiveIds = getEffectiveCategoryIds(categoryIds, allCategories);
  if (effectiveIds.length === 0) return 0;

  const { data } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("type", "expense")
    .gte("date", start)
    .lte("date", end)
    .or(`category_id.in.(${effectiveIds.join(",")}),subcategory_id.in.(${effectiveIds.join(",")})`);

  const total = (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  return total;
}
