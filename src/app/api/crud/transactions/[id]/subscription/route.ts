import { NextRequest } from "next/server";
import { getAccountAccess, getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { calendarDayInAppTimeZone } from "@/lib/date";
import { chargeDateFor } from "@/lib/subscriptionReconciliation";
import { isDay, learnedPattern, readSubscription } from "@/lib/subscriptionsServer";

type Params = { params: Promise<{ id: string }> };

/**
 * Link a transaction to the charge of one of my subscriptions, or unlink it.
 * Body: { subscription_id: string | null, charge_date?: "YYYY-MM-DD" } — without charge_date, the
 * scheduled charge closest to the transaction's day. The first link teaches the subscription its bank text.
 * Errors: charge_taken (409) when another transaction already covers that charge, no_charge_near when no
 * charge falls within ±15 days.
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as { subscription_id?: unknown; charge_date?: unknown } | null;
  if (!body || (body.subscription_id !== null && typeof body.subscription_id !== "string")) return jsonError("invalid_subscription");
  if (body.charge_date !== undefined && !isDay(body.charge_date)) return jsonError("invalid_charge_date");

  const { data: tx } = await supabase
    .from("transactions")
    .select("id, account_id, type, amount, date, description, bank_description, subscription_id, subscription_charge_date")
    .eq("id", id)
    .maybeSingle();
  if (!tx || !(await getAccountAccess(supabase, user.id, tx.account_id))) return jsonError("transaction_not_found", 404);

  if (body.subscription_id === null) {
    const { data, error } = await supabase.from("transactions").update({ subscription_id: null, subscription_charge_date: null }).eq("id", id).select().maybeSingle();
    if (error) return jsonServerError("transactions/subscription", error);
    return jsonResponse({ data });
  }

  if (tx.type !== "expense") return jsonError("not_an_expense");
  const sub = await readSubscription(supabase, user.id, body.subscription_id);
  if (!sub) return jsonError("Subscription not found", 404);
  const chargeDate = (body.charge_date as string | undefined) ?? chargeDateFor(sub, calendarDayInAppTimeZone(tx.date));
  if (!chargeDate) return jsonError("no_charge_near", 409);

  const taken = (sub.charges ?? []).find((c: { id: string; subscription_charge_date: string }) => c.subscription_charge_date === chargeDate && c.id !== id);
  if (taken) return jsonError("charge_taken", 409);

  const { data, error } = await supabase
    .from("transactions")
    .update({ subscription_id: sub.id, subscription_charge_date: chargeDate })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return jsonError("charge_taken", 409);
    return jsonServerError("transactions/subscription", error);
  }
  if (!data) return jsonError("transaction_not_found", 404);

  // A charge "not charged" that turns out to be linked stops being skipped; the first link teaches the bank text.
  const skipped: string[] = sub.skipped_charges ?? [];
  const updates: Record<string, unknown> = {};
  if (skipped.includes(chargeDate)) updates.skipped_charges = skipped.filter((d) => d !== chargeDate);
  if (!sub.match_pattern) {
    const pattern = learnedPattern(tx);
    if (pattern) updates.match_pattern = pattern;
  }
  if (Object.keys(updates).length) {
    const { error: subError } = await supabase.from("subscriptions").update(updates).eq("id", sub.id).eq("user_id", user.id);
    if (subError) console.error("[transactions/subscription] learn", subError);
  }
  return jsonResponse({ data: { ...data, charge_date: chargeDate } });
}
