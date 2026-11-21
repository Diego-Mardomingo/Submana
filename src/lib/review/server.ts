/**
 * Review deck, server side: what the import writes when movements arrive, and what the deck reads back.
 * Works with the user's client (RLS) or the service role (bank sync), always filtered by `userId`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyMovement,
  indexHistory,
  merchantOf,
  REVIEW_MAX_AGE_DAYS,
  settleMatch,
  type CategoryPair,
  type HistoryRow,
  type MovementLite,
  type ReviewReason,
} from "./classify";

/** How many earlier movements are read as evidence (newest first). */
const HISTORY_LIMIT = 3000;
const DAY_MS = 86_400_000;

export interface CategoryRule extends CategoryPair {
  id: string;
  pattern: string;
}

/** The user's rules by pattern. */
export async function loadRules(supabase: SupabaseClient, userId: string): Promise<Map<string, CategoryRule>> {
  const { data } = await supabase.from("category_rules").select("id, pattern, category_id, subcategory_id").eq("user_id", userId);
  return new Map(((data ?? []) as CategoryRule[]).map((rule) => [rule.pattern, rule]));
}

/**
 * Earlier movements with a category the user stands by: never categorised by the deck and still waiting
 * (its guesses would vouch for themselves).
 */
export async function loadHistory(supabase: SupabaseClient, userId: string, excludeIds: readonly string[] = []): Promise<HistoryRow[]> {
  const { data } = await supabase
    .from("transactions")
    .select("id, description, bank_description, category_id, subcategory_id")
    .eq("user_id", userId)
    .not("category_id", "is", null)
    .or("review_state.is.null,review_state.eq.done")
    .order("date", { ascending: false })
    .limit(HISTORY_LIMIT);
  const skip = new Set(excludeIds);
  return ((data ?? []) as HistoryRow[]).filter((row) => !skip.has(row.id));
}

/** The system "exclude from metrics" category (what a transfer between own accounts is filed under). */
export async function excludedCategoryId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.from("categories").select("id").eq("exclude_from_metrics", true).is("parent_id", null).is("user_id", null).limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export interface IncomingRow {
  /** Any key the caller uses to find the result again. */
  key: string;
  description: string | null;
  type: string;
  amount: number;
  date: string;
  /** Category of an earlier movement with exactly this text (the import's inheritance). */
  inherited: CategoryPair | null;
}

export interface ReviewPlan {
  pair: CategoryPair | null;
  /** null: too old for the deck (only gets the category). */
  reason: ReviewReason | null;
}

/**
 * Category and deck reason for movements about to be inserted. `others` are the movements of the same batch,
 * so a Bizum can be matched with the dinner that arrived in the same sync.
 */
export async function planReview(supabase: SupabaseClient, userId: string, rows: readonly IncomingRow[], now = Date.now()): Promise<Map<string, ReviewPlan>> {
  const plans = new Map<string, ReviewPlan>();
  if (rows.length === 0) return plans;
  const [rules, history] = await Promise.all([loadRules(supabase, userId), loadHistory(supabase, userId)]);
  const byMerchant = indexHistory(history);

  // Expenses a Bizum or transfer could be paying back: recent ones in the database plus this batch's.
  const incomes = rows.filter((r) => r.type === "income");
  let expenses: MovementLite[] = rows.filter((r) => r.type === "expense").map((r) => ({ id: r.key, amount: r.amount, type: r.type, date: r.date, description: r.description }));
  if (incomes.length > 0) {
    const times = incomes.map((r) => Date.parse(r.date)).filter(Number.isFinite);
    const { data } = await supabase
      .from("transactions")
      .select("id, amount, type, date, description")
      .eq("user_id", userId)
      .eq("type", "expense")
      .gte("date", new Date(Math.min(...times) - DAY_MS).toISOString())
      .lte("date", new Date(Math.max(...times)).toISOString());
    expenses = [...expenses, ...((data ?? []) as MovementLite[])];
  }

  for (const row of rows) {
    const merchant = merchantOf(row);
    const rule = merchant ? (rules.get(merchant) ?? null) : null;
    const { reason, pair } = classifyMovement({ tx: row, rule, inherited: row.inherited, merchantHistory: byMerchant.get(merchant) ?? [] });
    const recent = now - Date.parse(row.date) <= REVIEW_MAX_AGE_DAYS * DAY_MS;
    const settles = !rule && settleMatch({ id: row.key, amount: row.amount, type: row.type, date: row.date, description: row.description }, expenses);
    plans.set(row.key, { pair, reason: recent ? (settles ? "settle" : reason) : null });
  }
  return plans;
}

/**
 * After the import tagged transfers between own accounts (filed under "exclude from metrics"), the movements waiting
 * in the deck that got tagged say so: the new ones and their other half, which may have arrived in an earlier import.
 */
export async function markTransfers(supabase: SupabaseClient, userId: string) {
  const excluded = await excludedCategoryId(supabase);
  if (!excluded) return;
  await supabase
    .from("transactions")
    .update({ review_reason: "transfer" })
    .eq("user_id", userId)
    .eq("category_id", excluded)
    .eq("review_state", "pending")
    .neq("review_reason", "transfer");
}
