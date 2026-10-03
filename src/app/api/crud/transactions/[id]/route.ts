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
  account_id: string | null;
  type: string;
  date: string;
  source: string;
  shared_expense_id: string | null;
  [column: string]: unknown;
}

/**
 * A transaction I can use: my own row, or any row of an account I belong to (joint accounts hold
 * rows written by other members). Virtual rows (no account) are only visible to their owner.
 */
async function readAccessibleTransaction(supabase: SupabaseClient, userId: string, id: string, columns: string) {
  const { data } = await supabase.from("transactions").select(`${columns}, user_id, account_id`).eq("id", id).maybeSingle();
  const row = data as unknown as TxRow | null;
  if (!row) return null;
  if (!row.account_id) return row.user_id === userId ? row : null;
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

  const body = await parseRequestBody(request);
  const tx = readTransactionInput(body);

  const old = await readAccessibleTransaction(supabase, user.id, id, "*");
  if (!old) return jsonError("transaction_not_found", 404);

  // Virtual rows (a friend paid) have no account and are driven by the shared expense: only my own
  // category and description can change.
  if (old.source === "shared") {
    if (!(await areAccessibleCategories(supabase, user.id, [tx.category_id, tx.subcategory_id]))) return jsonError("invalid_category");
    const { data, error } = await supabase
      .from("transactions")
      .update({ category_id: tx.category_id, subcategory_id: tx.subcategory_id, description: tx.description })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .maybeSingle();
    if (error) return jsonServerError("crud/transactions/[id]", error);
    if (!data) return jsonError("transaction_not_found", 404);
    return jsonResponse({ data });
  }

  if (!Number.isFinite(tx.amount) || tx.amount <= 0 || !tx.date) return jsonError("missing_fields");
  if (tx.type !== "income" && tx.type !== "expense") return jsonError("invalid_type");
  // A row linked to a shared expense or settlement keeps its direction (the link depends on it).
  if (old.shared_expense_id && tx.type !== old.type) return jsonError("shared_tx_managed", 409);

  const accountId = tx.account_id ?? old.account_id;
  if (!accountId) return jsonError("Account not found", 404);
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

  const existing = await readAccessibleTransaction(supabase, user.id, id, "source, shared_expense_id");
  if (existing?.source === "shared") return jsonError("shared_tx_managed", 409);
  // A bank row tied to a shared expense is unlinked first so the expense keeps its invariants
  // (the payer then gets a virtual row for their share).
  if (existing?.shared_expense_id) {
    const { error: unlinkError } = await supabase.rpc("unlink_transaction", { p_tx_id: id });
    if (unlinkError) return jsonServerError("crud/transactions/[id]", unlinkError);
  }

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
