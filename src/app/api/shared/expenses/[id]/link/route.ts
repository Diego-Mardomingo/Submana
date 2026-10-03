import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { limitSharedWrites, rpcErrorResponse, UUID } from "@/lib/shared/server";

type Params = { params: Promise<{ id: string }> };

/**
 * Link one of MY bank transactions to the expense: the payer's bank row (expense) or my side of a
 * settlement (expense if I paid, income if I was paid). Linked rows leave my metrics accordingly.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  if (!UUID.test(id)) return jsonError("expense_not_found", 404);
  const limited = await limitSharedWrites(user.id);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.transaction_id !== "string" || !UUID.test(body.transaction_id)) return jsonError("invalid_transaction");

  const { data: expense, error: readError } = await supabase.from("shared_expenses").select("kind").eq("id", id).is("deleted_at", null).maybeSingle();
  if (readError) return jsonServerError("shared/expenses/link", readError);
  if (!expense) return jsonError("expense_not_found", 404);

  const { data, error } =
    expense.kind === "settlement"
      ? await supabase.rpc("link_settlement_transaction", { p_expense_id: id, p_tx_id: body.transaction_id })
      : await supabase.rpc("link_payer_transaction", { p_expense_id: id, p_tx_id: body.transaction_id });
  if (error) return rpcErrorResponse("shared/expenses/link", error);
  return jsonResponse({ data });
}

/** Unlink my bank row from the expense (a payer then gets a virtual row for their share). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  if (!UUID.test(id)) return jsonError("expense_not_found", 404);
  const limited = await limitSharedWrites(user.id);
  if (limited) return limited;

  const { data: mine, error: readError } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", user.id)
    .eq("shared_expense_id", id)
    .neq("source", "shared")
    .maybeSingle();
  if (readError) return jsonServerError("shared/expenses/link", readError);
  if (!mine) return jsonError("transaction_not_found", 404);

  const { error } = await supabase.rpc("unlink_transaction", { p_tx_id: mine.id });
  if (error) return rpcErrorResponse("shared/expenses/link", error);
  return jsonResponse({ data: { success: true } });
}
