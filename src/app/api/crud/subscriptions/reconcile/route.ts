import { getAuthedClient, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { reconcileHistory } from "@/lib/subscriptionAutoMatch";

/**
 * Once per subscription: looks for the charges of the ones never reconciled (created before automatic
 * reconciliation existed) among the last 24 months of expenses. Returns { linked, review }.
 */
export async function POST() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  try {
    const found = await reconcileHistory(supabase, user.id, { onlyNew: true });
    return jsonResponse({ data: { linked: found.linked, review: found.review } });
  } catch (error) {
    return jsonServerError("crud/subscriptions/reconcile", error);
  }
}
