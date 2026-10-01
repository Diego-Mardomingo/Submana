import { createClient } from "@/lib/supabase/server";
import {
  areAccessibleCategories,
  isOwnedAccount,
  jsonError,
  jsonResponse,
  jsonServerError,
  parseRequestBody,
} from "@/lib/apiHelpers";
import { NextRequest } from "next/server";
import { calendarDayInAppTimeZone } from "@/lib/date";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  const { body } = await parseRequestBody(request);
  const amount = parseFloat(body.amount || "");
  const type = body.type;
  const date = body.date;
  const description = body.description;
  const account_id = body.account_id || null;
  const category_id = body.category_id && body.category_id !== "" ? body.category_id : null;
  const subcategory_id = body.subcategory_id && body.subcategory_id !== "" ? body.subcategory_id : null;

  if (!id || !Number.isFinite(amount) || amount <= 0 || !date) {
    return jsonError("missing_fields");
  }
  if (type !== "income" && type !== "expense") {
    return jsonError("invalid_type");
  }

  const { data: oldTx, error: fetchError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !oldTx) {
    return jsonError("transaction_not_found", 404);
  }

  const newAccountId = account_id && account_id !== "" ? account_id : oldTx.account_id;
  if (!(await isOwnedAccount(supabase, user.id, newAccountId))) {
    return jsonError("Account not found", 404);
  }
  if (!(await areAccessibleCategories(supabase, user.id, [category_id, subcategory_id]))) {
    return jsonError("invalid_category");
  }

  // El formulario envía solo el día; si coincide con el guardado se conserva la hora original.
  const isSameStoredDay =
    /^\d{4}-\d{2}-\d{2}$/.test(date) && calendarDayInAppTimeZone(String(oldTx.date)) === date;
  const effectiveDate = isSameStoredDay ? oldTx.date : date;

  const descriptionChanged = (description || null) !== (oldTx.description || null);
  const amountChanged = amount !== Number(oldTx.amount);
  const dateChanged = new Date(effectiveDate).getTime() !== new Date(oldTx.date).getTime();
  const shouldClearHash = oldTx.external_hash && (descriptionChanged || amountChanged || dateChanged);
  const shouldClearImportLineId = oldTx.import_line_id && (descriptionChanged || amountChanged || dateChanged);

  // Actualización y ajuste de saldo (cuenta antigua y nueva) en una sola transacción.
  const { data: updatedTx, error: updateError } = await supabase.rpc("update_transaction_with_balance", {
    p_id: id,
    p_user_id: user.id,
    p_account_id: newAccountId,
    p_amount: amount,
    p_type: type,
    p_date: effectiveDate,
    p_description: description || null,
    p_category_id: category_id,
    p_subcategory_id: subcategory_id,
    p_clear_external_hash: !!shouldClearHash,
    p_clear_import_line_id: !!shouldClearImportLineId,
  });

  if (updateError) {
    return jsonServerError("PATCH /api/crud/transactions/[id]", updateError);
  }
  if (!updatedTx?.id) {
    return jsonError("transaction_not_found", 404);
  }

  return jsonResponse({ data: updatedTx });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const skipBalanceAdjust =
    request.nextUrl.searchParams.get("skip_balance_adjust") === "1";
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  if (!id) {
    return jsonError("missing_id");
  }

  // skip_balance_adjust: al resolver duplicados de una importación el saldo ya es el del extracto.
  const { data: deleted, error } = await supabase.rpc("delete_transaction_with_balance", {
    p_id: id,
    p_user_id: user.id,
    p_adjust_balance: !skipBalanceAdjust,
  });

  if (error) {
    return jsonServerError("DELETE /api/crud/transactions/[id]", error);
  }
  if (!deleted?.id) {
    return jsonError("transaction_not_found", 404);
  }

  return jsonResponse({ data: { success: true } });
}
