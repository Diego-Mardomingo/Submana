import { NextRequest } from "next/server";
import {
  adjustAccountBalance,
  getAuthedClient,
  jsonError,
  jsonResponse,
  parseRequestBody,
  readTransactionInput,
  signedAmount,
  unauthorized,
} from "@/lib/apiHelpers";
import { calendarDayInAppTimeZone } from "@/lib/date";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const tx = readTransactionInput(await parseRequestBody(request));
  if (isNaN(tx.amount) || !tx.type || !tx.date) return jsonError("missing_fields");

  const { data: old } = await supabase.from("transactions").select("*").eq("id", id).eq("user_id", user.id).single();
  if (!old) return jsonError("transaction_not_found", 404);

  // The form only sends the day; if it matches the stored one, keep the original time.
  if (/^\d{4}-\d{2}-\d{2}$/.test(tx.date) && calendarDayInAppTimeZone(String(old.date)) === tx.date) tx.date = old.date;

  // Editing the identifying fields detaches the row from its bank statement line.
  const identityChanged =
    tx.description !== (old.description || null) ||
    tx.amount !== Number(old.amount) ||
    new Date(tx.date).getTime() !== new Date(old.date).getTime();

  await adjustAccountBalance(supabase, old.account_id, -signedAmount(old));
  const { data, error } = await supabase
    .from("transactions")
    .update({ ...tx, ...(identityChanged && { external_hash: null, import_line_id: null }) })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();
  if (error) return jsonError(error.message, 500);

  await adjustAccountBalance(supabase, tx.account_id, signedAmount(tx));
  return jsonResponse({ data });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { data: tx } = await supabase.from("transactions").select("account_id, amount, type").eq("id", id).eq("user_id", user.id).single();
  const { error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", user.id);
  if (error) return jsonError(error.message, 500);

  if (tx && request.nextUrl.searchParams.get("skip_balance_adjust") !== "1") {
    await adjustAccountBalance(supabase, tx.account_id, -signedAmount(tx));
  }
  return jsonResponse({ data: { success: true } });
}
