import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse, parseRequestBody } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";

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

  if (!id || isNaN(amount) || !type || !date) {
    return jsonError("missing_fields");
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

  if (oldTx.account_id) {
    const { data: oldAcc } = await supabase
      .from("accounts")
      .select("balance")
      .eq("id", oldTx.account_id)
      .single();
    if (oldAcc) {
      let revertedBalance = Number(oldAcc.balance);
      if (oldTx.type === "income") revertedBalance -= Number(oldTx.amount);
      else revertedBalance += Number(oldTx.amount);
      await supabase
        .from("accounts")
        .update({ balance: revertedBalance })
        .eq("id", oldTx.account_id);
    }
  }

  const { data: updatedTx, error: updateError } = await supabase
    .from("transactions")
    .update({
      amount,
      type,
      date,
      description: description || null,
      account_id: account_id && account_id !== "" ? account_id : null,
      category_id,
      subcategory_id,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (updateError) {
    return jsonError(updateError.message, 500);
  }

  const newAccountId = account_id && account_id !== "" ? account_id : null;
  if (newAccountId) {
    const { data: newAcc } = await supabase
      .from("accounts")
      .select("balance")
      .eq("id", newAccountId)
      .single();
    if (newAcc) {
      let newBalance = Number(newAcc.balance);
      if (type === "income") newBalance += amount;
      else newBalance -= amount;
      await supabase
        .from("accounts")
        .update({ balance: newBalance })
        .eq("id", newAccountId);
    }
  }

  return jsonResponse({ data: updatedTx });
}

export async function DELETE(
  _request: NextRequest,
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

  if (!id) {
    return jsonError("missing_id");
  }

  const { data: transaction } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return jsonError(error.message, 500);
  }

  if (transaction && transaction.account_id) {
    const { data: account } = await supabase
      .from("accounts")
      .select("balance")
      .eq("id", transaction.account_id)
      .single();
    if (account) {
      let newBalance = Number(account.balance);
      if (transaction.type === "income")
        newBalance -= Number(transaction.amount);
      else newBalance += Number(transaction.amount);
      await supabase
        .from("accounts")
        .update({ balance: newBalance })
        .eq("id", transaction.account_id);
    }
  }

  return jsonResponse({ data: { success: true } });
}
