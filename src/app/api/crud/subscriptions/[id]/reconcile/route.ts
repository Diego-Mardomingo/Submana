import { getAuthedClient, jsonError, jsonResponse, unauthorized } from "@/lib/apiHelpers";
import { reconcileSubscription } from "@/lib/subscriptionAutoMatch";

type Params = { params: Promise<{ id: string }> };

/** Looks for the charges of one of my subscriptions among the last 24 months of expenses. Returns it with `reconciled: { linked, review }`. */
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  const data = await reconcileSubscription(supabase, user.id, id);
  if (!data) return jsonError("Subscription not found", 404);
  return jsonResponse({ data });
}
