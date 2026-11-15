import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { missedChargeDedupeKey } from "@/lib/notifications/jobs/missedCharges";
import { priceChangeDedupeKey } from "@/lib/notifications/events/subscriptions";
import { isDay, markNotificationsRead, readSubscription, SUBSCRIPTION_SELECT } from "@/lib/subscriptionsServer";

type Params = { params: Promise<{ id: string }> };

const ACTIONS = ["accept_price", "undo_price", "dismiss_price", "undismiss_price", "skip", "unskip"] as const;
type Action = (typeof ACTIONS)[number];

/**
 * Decide about one charge of a subscription:
 *  - accept_price: the linked charge's amount becomes the price from that day on (a "detected" step).
 *  - undo_price: takes back accept_price (removes that step; the price returns to the one before).
 *  - dismiss_price: keep the price; the charge stays as "another amount" without asking again.
 *  - undismiss_price: asks again about that charge.
 *  - skip / unskip: mark the charge as not charged (no warning, doesn't count in the total) or undo it.
 * Body: { action, charge_date: "YYYY-MM-DD" }. Returns the subscription.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as { action?: Action; charge_date?: unknown } | null;
  if (!body || !ACTIONS.includes(body.action as Action)) return jsonError("invalid_action");
  if (!isDay(body.charge_date)) return jsonError("invalid_charge_date");
  const chargeDate = body.charge_date;

  const sub = await readSubscription(supabase, user.id, id);
  if (!sub) return jsonError("Subscription not found", 404);

  let updates: Record<string, unknown>;
  switch (body.action) {
    case "accept_price": {
      const charge = (sub.charges ?? []).find((c: { subscription_charge_date: string }) => c.subscription_charge_date === chargeDate);
      if (!charge) return jsonError("charge_not_linked", 409);
      const cost = Number(charge.amount);
      // The step goes in first, so the trigger on subscriptions.cost finds it and doesn't add one from today.
      const { error: stepError } = await supabase
        .from("subscription_price_history")
        .upsert({ subscription_id: id, user_id: user.id, cost, valid_from: chargeDate, source: "detected" }, { onConflict: "subscription_id,valid_from" });
      if (stepError) return jsonServerError("subscriptions/charges", stepError);
      updates = { cost, dismissed_price_charge: null };
      break;
    }
    case "undo_price": {
      const { error: deleteError } = await supabase
        .from("subscription_price_history")
        .delete()
        .eq("subscription_id", id)
        .eq("valid_from", chargeDate)
        .eq("source", "detected");
      if (deleteError) return jsonServerError("subscriptions/charges", deleteError);
      const { data: previous } = await supabase
        .from("subscription_price_history")
        .select("cost")
        .eq("subscription_id", id)
        .lt("valid_from", chargeDate)
        .order("valid_from", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!previous) return jsonError("no_previous_price", 409);
      updates = { cost: Number(previous.cost) };
      break;
    }
    case "dismiss_price":
      updates = { dismissed_price_charge: chargeDate };
      break;
    case "undismiss_price":
      updates = { dismissed_price_charge: null };
      break;
    case "skip":
    case "unskip": {
      const skipped = new Set<string>(sub.skipped_charges ?? []);
      if (body.action === "skip") skipped.add(chargeDate);
      else skipped.delete(chargeDate);
      updates = { skipped_charges: [...skipped].sort() };
      break;
    }
    default:
      return jsonError("invalid_action");
  }

  const { data, error } = await supabase.from("subscriptions").update(updates).eq("id", id).eq("user_id", user.id).select(SUBSCRIPTION_SELECT).maybeSingle();
  if (error) return jsonServerError("subscriptions/charges", error);
  if (!data) return jsonError("Subscription not found", 404);
  // The notification about what was just decided is no longer news.
  if (body.action === "accept_price" || body.action === "dismiss_price") await markNotificationsRead(supabase, user.id, [priceChangeDedupeKey(id, chargeDate)]);
  if (body.action === "skip") await markNotificationsRead(supabase, user.id, [missedChargeDedupeKey(id, chargeDate)]);
  return jsonResponse({ data });
}
