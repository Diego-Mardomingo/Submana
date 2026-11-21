import { NextRequest } from "next/server";
import { areAccessibleCategories, getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { notifyBudgetThresholds, requestLang } from "@/lib/notifications/budgets";
import { merchantOf, samePair, type CategoryPair, type ReviewState } from "@/lib/review/classify";
import type { ReviewUndo } from "@/lib/review/types";

type Params = { params: Promise<{ id: string }> };

const STATES: ReviewState[] = ["pending", "later", "done"];
const isId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

function readPair(value: unknown): CategoryPair | null | "invalid" {
  if (value == null) return null;
  if (typeof value !== "object") return "invalid";
  const { category_id, subcategory_id } = value as Record<string, unknown>;
  if (category_id != null && !isId(category_id)) return "invalid";
  if (subcategory_id != null && !isId(subcategory_id)) return "invalid";
  if (subcategory_id && !category_id) return "invalid";
  return { category_id: (category_id as string) ?? null, subcategory_id: (subcategory_id as string) ?? null };
}

/**
 * A card of the deck: `confirm` (optionally with another category, and `learn` to remember it for the merchant),
 * `later` (stays pending for next time) or `restore` (the deck's undo, with what `confirm`/`later` returned).
 * Returns the `undo` that puts the card back as it was.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action;
  if (action !== "confirm" && action !== "later" && action !== "restore") return jsonError("invalid_action");

  const { data: tx } = await supabase
    .from("transactions")
    .select("id, type, date, description, bank_description, category_id, subcategory_id, review_state, account:accounts(is_joint)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!tx || !tx.review_state || (tx.account as unknown as { is_joint: boolean } | null)?.is_joint) return jsonError("transaction_not_found", 404);

  const pattern = merchantOf(tx);
  const before: ReviewUndo = { review_state: tx.review_state as ReviewState, category_id: tx.category_id, subcategory_id: tx.subcategory_id, pattern };
  const update: Record<string, unknown> = {};
  let ruleChange: { set: CategoryPair } | { remove: true } | null = null;

  if (action === "later") update.review_state = "later";
  else if (action === "confirm") {
    const category = readPair(body?.category);
    if (category === "invalid") return jsonError("invalid_category");
    if (category && !samePair(category, tx)) {
      if (!(await areAccessibleCategories(supabase, user.id, [category.category_id, category.subcategory_id]))) return jsonError("invalid_category");
      update.category_id = category.category_id;
      update.subcategory_id = category.subcategory_id;
    }
    update.review_state = "done";
    const finalPair = category ?? { category_id: tx.category_id, subcategory_id: tx.subcategory_id };
    if (body?.learn === true && pattern && finalPair.category_id) ruleChange = { set: finalPair };
  } else {
    const undo = body?.undo as Record<string, unknown> | undefined;
    const pair = readPair(undo);
    if (!undo || pair === "invalid" || !pair || !STATES.includes(undo.review_state as ReviewState)) return jsonError("invalid_undo");
    if (!samePair(pair, tx)) {
      if (pair.category_id && !(await areAccessibleCategories(supabase, user.id, [pair.category_id, pair.subcategory_id]))) return jsonError("invalid_category");
      update.category_id = pair.category_id;
      update.subcategory_id = pair.subcategory_id;
    }
    update.review_state = undo.review_state;
    if ("rule" in undo && pattern) {
      const rule = readPair(undo.rule);
      if (rule === "invalid") return jsonError("invalid_undo");
      ruleChange = rule?.category_id ? { set: rule } : { remove: true };
    }
  }

  // The rule as it was, so undoing this puts it back.
  if (ruleChange) {
    const { data: previous } = await supabase.from("category_rules").select("category_id, subcategory_id").eq("user_id", user.id).eq("pattern", pattern).maybeSingle();
    before.rule = previous ?? null;
    const { error } =
      "set" in ruleChange
        ? await supabase
            .from("category_rules")
            .upsert({ user_id: user.id, pattern, ...ruleChange.set, updated_at: new Date().toISOString() }, { onConflict: "user_id,pattern" })
        : await supabase.from("category_rules").delete().eq("user_id", user.id).eq("pattern", pattern);
    if (error) return jsonServerError("review/[id] rule", error);
  }

  const { error } = await supabase.from("transactions").update(update).eq("id", id).eq("user_id", user.id);
  if (error) return jsonServerError("review/[id]", error);

  // Another category moves the money between budgets.
  if ("category_id" in update && tx.type === "expense") notifyBudgetThresholds(user.id, [tx.date], await requestLang());
  return jsonResponse({ data: { undo: before } });
}
