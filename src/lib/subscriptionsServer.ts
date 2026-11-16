import type { SupabaseClient } from "@supabase/supabase-js";
import { shareLinkedCharges } from "@/lib/sharedSubscriptions";

/**
 * Columns of a subscription as the API returns it: the row plus its price steps and the transactions
 * linked to its charges (see lib/subscriptionReconciliation).
 */
export const SUBSCRIPTION_SELECT =
  "*, price_history:subscription_price_history(cost, valid_from, source), charges:transactions!transactions_subscription_id_fkey(id, amount, date, subscription_charge_date, description, bank_description), reviews:transactions!transactions_subscription_review_id_fkey(id, amount, date, subscription_review_date, description, bank_description), group_expenses:shared_expenses!shared_expenses_subscription_id_fkey(id, subscription_charge_date, deleted_at)";

export const isDay = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

/** One of my subscriptions, with its history and linked charges; null if it isn't mine. */
export async function readSubscription(supabase: SupabaseClient, userId: string, id: string) {
  const { data } = await supabase.from("subscriptions").select(SUBSCRIPTION_SELECT).eq("id", id).eq("user_id", userId).maybeSingle();
  return data;
}

/** The bank text worth learning from a linked transaction: the bank's own line, else the description. */
export function learnedPattern(tx: { bank_description?: string | null; description?: string | null }) {
  const text = (tx.bank_description || tx.description || "").trim();
  return text ? text.slice(0, 200) : null;
}

type LinkableTx = { id: string; bank_description?: string | null; description?: string | null };
type LinkableSub = { id: string; charges?: { id: string; subscription_charge_date: string }[] | null; skipped_charges?: string[] | null; match_pattern?: string | null };

/**
 * Links a transaction to one charge of my subscription (clearing any pending review), un-skips that
 * charge and, the first time, learns the bank text. Returns the row, or an error code: charge_taken.
 */
export async function linkCharge(supabase: SupabaseClient, userId: string, tx: LinkableTx, sub: LinkableSub, chargeDate: string): Promise<{ error: "charge_taken" | "transaction_not_found" } | { data: Record<string, unknown> }> {
  if ((sub.charges ?? []).some((c) => c.subscription_charge_date === chargeDate && c.id !== tx.id)) return { error: "charge_taken" };
  const { data, error } = await supabase
    .from("transactions")
    .update({ subscription_id: sub.id, subscription_charge_date: chargeDate, subscription_review_id: null, subscription_review_date: null })
    .eq("id", tx.id)
    .select()
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return { error: "charge_taken" };
    throw error;
  }
  if (!data) return { error: "transaction_not_found" };

  const skipped = sub.skipped_charges ?? [];
  const updates: Record<string, unknown> = {};
  if (skipped.includes(chargeDate)) updates.skipped_charges = skipped.filter((d) => d !== chargeDate);
  if (!sub.match_pattern) {
    const pattern = learnedPattern(tx);
    if (pattern) updates.match_pattern = pattern;
  }
  if (Object.keys(updates).length) {
    const { error: subError } = await supabase.from("subscriptions").update(updates).eq("id", sub.id).eq("user_id", userId);
    if (subError) console.error("[subscriptions] learn", subError);
  }
  // Another row waiting to be this same charge no longer asks.
  await supabase
    .from("transactions")
    .update({ subscription_review_id: null, subscription_review_date: null })
    .eq("subscription_review_id", sub.id)
    .eq("subscription_review_date", chargeDate)
    .neq("id", tx.id);
  // Shared with a Subcount group: the charge goes to the group.
  await shareLinkedCharges(supabase, userId, [sub.id]);
  return { data };
}

/** Remembers that this transaction is not a charge of that subscription (automatic matching skips it). */
export async function dismissSubscription(supabase: SupabaseClient, txId: string, subscriptionId: string, current: string[] | null | undefined) {
  const ids = current ?? [];
  const next = ids.includes(subscriptionId) ? ids : [...ids, subscriptionId];
  return supabase
    .from("transactions")
    .update({ subscription_dismissed_ids: next, subscription_review_id: null, subscription_review_date: null })
    .eq("id", txId)
    .select()
    .maybeSingle();
}

/**
 * Marks as read the notifications about something the user just decided (a price accepted or ignored,
 * a charge marked as not charged, a movement confirmed or not). Never fails the action.
 */
export async function markNotificationsRead(supabase: SupabaseClient, userId: string, dedupeKeys: string[]) {
  if (dedupeKeys.length === 0) return;
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).in("dedupe_key", dedupeKeys).is("read_at", null);
  if (error) console.error("[subscriptions] mark notifications read", error);
}
