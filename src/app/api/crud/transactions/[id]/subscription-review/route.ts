import { NextRequest } from "next/server";
import { getAccountAccess, getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { dismissSubscription, linkCharge, markNotificationsRead, readSubscription } from "@/lib/subscriptionsServer";

type Params = { params: Promise<{ id: string }> };

/**
 * Answers "is this the charge of X?" for a transaction automatic matching wasn't sure about.
 * Body: { action: "confirm" | "dismiss" }. confirm links it to that charge (learning the bank text);
 * dismiss clears the question and never proposes that subscription for it again.
 * Errors: no_review (409) when nothing is pending, charge_taken (409).
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  if (body?.action !== "confirm" && body?.action !== "dismiss") return jsonError("invalid_action");

  const { data: tx } = await supabase
    .from("transactions")
    .select("id, account_id, description, bank_description, subscription_review_id, subscription_review_date, subscription_dismissed_ids")
    .eq("id", id)
    .maybeSingle();
  if (!tx || !(await getAccountAccess(supabase, user.id, tx.account_id))) return jsonError("transaction_not_found", 404);
  if (!tx.subscription_review_id || !tx.subscription_review_date) return jsonError("no_review", 409);
  const sub = await readSubscription(supabase, user.id, tx.subscription_review_id);
  if (!sub) return jsonError("Subscription not found", 404);

  // Answered here: the "is this the charge?" notification is no longer news.
  await markNotificationsRead(supabase, user.id, [`subscription.match_review:${id}:${sub.id}`]);
  try {
    if (body.action === "dismiss") {
      const { data, error } = await dismissSubscription(supabase, id, sub.id, tx.subscription_dismissed_ids);
      if (error) throw error;
      return jsonResponse({ data });
    }
    const result = await linkCharge(supabase, user.id, tx, sub, tx.subscription_review_date);
    if ("error" in result) return jsonError(result.error, result.error === "charge_taken" ? 409 : 404);
    return jsonResponse({ data: { ...result.data, charge_date: tx.subscription_review_date } });
  } catch (error) {
    return jsonServerError("transactions/subscription-review", error);
  }
}
