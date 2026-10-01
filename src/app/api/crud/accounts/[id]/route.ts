import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonServerError, jsonResponse, parseRequestBody } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";

export async function GET(
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

  const { data: account, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return jsonServerError("/api/crud/accounts/[id]", error);
  }

  if (!account) {
    return jsonError("Account not found", 404);
  }

  const { count: transactionCount } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("account_id", id);

  return jsonResponse({ data: { ...account, transaction_count: transactionCount || 0 } });
}

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
  const name = body.name;
  const icon = body.icon;
  const color = body.color;
  const bank_provider = body.bank_provider !== undefined ? body.bank_provider : undefined;

  if (!id || !name) {
    return jsonError("missing_fields");
  }

  const updateData: Record<string, unknown> = { name, icon, color };
  // Sin "balance" en el cuerpo no se toca el saldo (antes se ponía a 0).
  if (body.balance !== undefined && body.balance !== "") {
    const balance = parseFloat(body.balance);
    if (!Number.isFinite(balance)) {
      return jsonError("invalid_balance");
    }
    updateData.balance = balance;
  }
  if (bank_provider !== undefined) {
    updateData.bank_provider = bank_provider || null;
  }

  const { data: updatedData, error } = await supabase
    .from("accounts")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();

  if (error) {
    return jsonServerError("/api/crud/accounts/[id]", error);
  }

  if (!updatedData) {
    return jsonError("Account not found", 404);
  }

  return jsonResponse({ data: updatedData });
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

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return jsonServerError("/api/crud/accounts/[id]", error);
  }

  return jsonResponse({ data: { success: true } });
}
