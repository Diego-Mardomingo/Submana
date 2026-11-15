import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Columns of a subscription as the API returns it: the row plus its price steps and the transactions
 * linked to its charges (see lib/subscriptionReconciliation).
 */
export const SUBSCRIPTION_SELECT =
  "*, price_history:subscription_price_history(cost, valid_from, source), charges:transactions!transactions_subscription_id_fkey(id, amount, date, subscription_charge_date, description, bank_description)";

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
