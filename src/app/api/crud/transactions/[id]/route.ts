import { NextRequest } from "next/server";
import {
  areAccessibleCategories,
  getAuthedClient,
  getAccountAccess,
  jsonError,
  jsonResponse,
  jsonServerError,
  parseRequestBody,
  readTransactionInput,
  unauthorized,
} from "@/lib/apiHelpers";
import { calendarDayInAppTimeZone } from "@/lib/date";
import type { SupabaseClient } from "@supabase/supabase-js";

type Params = { params: Promise<{ id: string }> };

interface TxRow {
  user_id: string;
  account_id: string;
  type: string;
  date: string;
  [column: string]: unknown;
}

/**
 * A transaction I can use: my own row, or any row of an account I belong to (joint accounts hold
 * rows written by other members).
 */
async function readAccessibleTransaction(supabase: SupabaseClient, userId: string, id: string, columns: string) {
  const { data } = await supabase.from("transactions").select(`${columns}, user_id, account_id`).eq("id", id).maybeSingle();
  const row = data as unknown as TxRow | null;
  if (!row) return null;
  return (await getAccountAccess(supabase, userId, row.account_id)) ? row : null;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const data = await readAccessibleTransaction(supabase, user.id, id, "*");
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

  const old = await readAccessibleTransaction(supabase, user.id, id, "*");
  if (!old) return jsonError("transaction_not_found", 404);

  const accountId = tx.account_id ?? old.account_id;
  const access = await getAccountAccess(supabase, user.id, accountId);
  if (!access) return jsonError("Account not found", 404);
  if (!(await areAccessibleCategories(supabase, user.id, [tx.category_id, tx.subcategory_id], { systemOnly: access.isJoint }))) {
    return jsonError("invalid_category");
  }

  // The form only sends the day; if it matches the stored one, keep the original time.
  if (/^\d{4}-\d{2}-\d{2}$/.test(tx.date) && calendarDayInAppTimeZone(String(old.date)) === tx.date) tx.date = old.date;

  // Update plus balance adjustment (old and new account) in a single Postgres transaction.
  // Editing never detaches a row from its bank line (import_line_id, booked_at...): the user's fields are independent of it.
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
