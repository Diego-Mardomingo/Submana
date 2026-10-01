import type { SupabaseClient } from "@supabase/supabase-js";
import { calendarMonthsUtcHalfOpenRange } from "@/lib/date";
import { detectTransferIds } from "@/lib/transferDetection";

/**
 * Loads the month's transactions once and returns a function that computes the spent amount
 * of a budget. Transfers and categories excluded from metrics never count; an empty
 * category list means a general budget (all expenses). Linked parents include their subcategories.
 */
export async function loadBudgetSpentCalculator(supabase: SupabaseClient, userId: string, year: number, month: number) {
  const { startIso, endExclusiveIso } = calendarMonthsUtcHalfOpenRange(year, month, year, month);
  const [{ data: categories }, { data: transactions }] = await Promise.all([
    supabase.from("categories").select("id, parent_id, exclude_from_metrics").or(`user_id.eq.${userId},user_id.is.null`),
    supabase
      .from("transactions")
      .select("id, amount, type, date, account_id, category_id, subcategory_id")
      .eq("user_id", userId)
      .gte("date", startIso)
      .lt("date", endExclusiveIso),
  ]);

  const parentOf = new Map((categories ?? []).filter((c) => c.parent_id).map((c) => [c.id, c.parent_id as string]));
  const excluded = new Set((categories ?? []).filter((c) => c.exclude_from_metrics).map((c) => c.id));
  const txs = (transactions ?? []).map((tx) => ({ ...tx, amount: Number(tx.amount) }));
  const transferIds = detectTransferIds(txs);
  const expenses = txs.filter((tx) => {
    if (tx.type !== "expense" || transferIds.has(tx.id)) return false;
    const sub = tx.subcategory_id;
    return !(excluded.has(tx.category_id) || (sub && (excluded.has(sub) || excluded.has(parentOf.get(sub) ?? ""))));
  });

  return (categoryIds: string[]) => {
    const linked = new Set(categoryIds);
    const counts = (id: string | null) => !!id && (linked.has(id) || linked.has(parentOf.get(id) ?? ""));
    return expenses
      .filter((tx) => categoryIds.length === 0 || counts(tx.category_id) || counts(tx.subcategory_id))
      .reduce((sum, tx) => sum + tx.amount, 0);
  };
}

/** Validated budget fields from a JSON body; `undefined` means "not provided / invalid". */
export function readBudgetInput(body: Record<string, unknown>) {
  const amount = typeof body.amount === "number" ? body.amount : parseFloat(String(body.amount));
  return {
    amount: Number.isFinite(amount) && amount >= 0 ? amount : undefined,
    color: body.color === undefined ? undefined : (typeof body.color === "string" && body.color) || null,
    categoryIds: Array.isArray(body.category_ids)
      ? body.category_ids.filter((c): c is string => typeof c === "string")
      : undefined,
  };
}
