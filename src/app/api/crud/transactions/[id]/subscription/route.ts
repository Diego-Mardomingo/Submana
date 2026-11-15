import { NextRequest } from "next/server";
import { getAccountAccess, getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { calendarDayInAppTimeZone } from "@/lib/date";
import { chargeDateFor } from "@/lib/subscriptionReconciliation";
import { dismissSubscription, isDay, linkCharge, readSubscription } from "@/lib/subscriptionsServer";

type Params = { params: Promise<{ id: string }> };

/**
 * Link a transaction to the charge of one of my subscriptions, or unlink it.
 * Body: { subscription_id: string | null, charge_date?: "YYYY-MM-DD" } — without charge_date, the
 * scheduled charge closest to the transaction's day. The first link teaches the subscription its bank text.
 * Unlinking remembers the subscription, so automatic matching doesn't link it back.
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
    .select("id, account_id, type, amount, date, description, bank_description, subscription_id, subscription_charge_date, subscription_dismissed_ids")
    .eq("id", id)
    .maybeSingle();
  if (!tx || !(await getAccountAccess(supabase, user.id, tx.account_id))) return jsonError("transaction_not_found", 404);

  if (body.subscription_id === null) {
    const { error } = await supabase.from("transactions").update({ subscription_id: null, subscription_charge_date: null }).eq("id", id);
    if (error) return jsonServerError("transactions/subscription", error);
    // Unlinked by hand: automatic matching won't link it to that subscription again.
    if (!tx.subscription_id) return jsonResponse({ data: tx });
    const { data, error: dismissError } = await dismissSubscription(supabase, id, tx.subscription_id, tx.subscription_dismissed_ids);
    if (dismissError) return jsonServerError("transactions/subscription", dismissError);
    return jsonResponse({ data });
  }

  if (tx.type !== "expense") return jsonError("not_an_expense");
  const sub = await readSubscription(supabase, user.id, body.subscription_id);
  if (!sub) return jsonError("Subscription not found", 404);
  const chargeDate = (body.charge_date as string | undefined) ?? chargeDateFor(sub, calendarDayInAppTimeZone(tx.date));
  if (!chargeDate) return jsonError("no_charge_near", 409);

  let result;
  try {
    result = await linkCharge(supabase, user.id, tx, sub, chargeDate);
  } catch (error) {
    return jsonServerError("transactions/subscription", error);
  }
  if ("error" in result) return jsonError(result.error, result.error === "charge_taken" ? 409 : 404);
  const data = result.data;

  return jsonResponse({ data: { ...data, charge_date: chargeDate } });
}
