import { NextRequest } from "next/server";
import {
  areAccessibleCategories,
  getAuthedClient,
  isOwnedAccount,
  jsonError,
  jsonResponse,
  jsonServerError,
  parseRequestBody,
  readTransactionInput,
  unauthorized,
} from "@/lib/apiHelpers";
import { calendarDayInAppTimeZone } from "@/lib/date";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { data, error } = await supabase.from("transactions").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) return jsonServerError("crud/transactions/[id]", error);
  if (!data) return jsonError("transaction_not_found", 404);
  return jsonResponse({ data });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const tx = readTransactionInput(await parseRequestBody(request));
  if (!Number.isFinite(tx.amount) || tx.amount <= 0 || !tx.date) return jsonError("missing_fields");
  if (tx.type !== "income" && tx.type !== "expense") return jsonError("invalid_type");

  const { data: old } = await supabase.from("transactions").select("*").eq("id", id).eq("user_id", user.id).single();
  if (!old) return jsonError("transaction_not_found", 404);

  const accountId: string = tx.account_id ?? old.account_id;
  if (!(await isOwnedAccount(supabase, user.id, accountId))) return jsonError("Account not found", 404);
  if (!(await areAccessibleCategories(supabase, user.id, [tx.category_id, tx.subcategory_id]))) return jsonError("invalid_category");

  // The form only sends the day; if it matches the stored one, keep the original time.
  if (/^\d{4}-\d{2}-\d{2}$/.test(tx.date) && calendarDayInAppTimeZone(String(old.date)) === tx.date) tx.date = old.date;

  // Editing the identifying fields detaches the row from its bank statement line.
  const identityChanged =
    tx.description !== (old.description || null) ||
    tx.amount !== Number(old.amount) ||
    new Date(tx.date).getTime() !== new Date(old.date).getTime();

  // Update plus balance adjustment (old and new account) in a single Postgres transaction.
  const { data, error } = await supabase.rpc("update_transaction_with_balance", {
    p_id: id,
    p_user_id: user.id,
    p_account_id: accountId,
    p_amount: tx.amount,
    p_type: tx.type,
    p_date: tx.date,
    p_description: tx.description,
    p_category_id: tx.category_id,
    p_subcategory_id: tx.subcategory_id,
    p_clear_external_hash: identityChanged,
    p_clear_import_line_id: identityChanged,
  });
  if (error) return jsonServerError("crud/transactions/[id]", error);
  if (!data?.id) return jsonError("transaction_not_found", 404);
  return jsonResponse({ data });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  // skip_balance_adjust: when resolving import duplicates the balance already is the statement's.
  const { data, error } = await supabase.rpc("delete_transaction_with_balance", {
    p_id: id,
    p_user_id: user.id,
    p_adjust_balance: request.nextUrl.searchParams.get("skip_balance_adjust") !== "1",
  });
  if (error) return jsonServerError("crud/transactions/[id]", error);
  if (!data?.id) return jsonError("transaction_not_found", 404);
  return jsonResponse({ data: { success: true } });
}
