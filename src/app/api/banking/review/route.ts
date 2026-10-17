import { NextRequest } from "next/server";
import { getAccountAccess, getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A bank movement flagged as a possible duplicate: `merge` folds it into the manual transaction it may
 * repeat (that one keeps the user's date, description and category); `dismiss` keeps both.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  let body: { transaction_id?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  if (!body.transaction_id || (body.action !== "merge" && body.action !== "dismiss")) return jsonError("invalid_review");

  // RLS: the user only sees rows of accounts they can access.
  const { data: tx } = await supabase.from("transactions").select("id, account_id, review_match_id").eq("id", body.transaction_id).maybeSingle();
  if (!tx?.account_id || !tx.review_match_id) return jsonError("transaction_not_found", 404);
  if (!(await getAccountAccess(supabase, user.id, tx.account_id))) return jsonError("transaction_not_found", 404);

  const { data, error } = await createAdminClient().rpc("resolve_bank_review", { p_tx_id: tx.id, p_merge: body.action === "merge" });
  if (error) return jsonServerError("banking/review", error);
  if (body.action === "merge" && !data?.id) return jsonError("match_gone", 409);
  return jsonResponse({ data: { id: data?.id ?? tx.id } });
}
