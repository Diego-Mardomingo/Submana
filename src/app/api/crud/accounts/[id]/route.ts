import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, jsonServerError, parseRequestBody, unauthorized } from "@/lib/apiHelpers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { name, icon, color, balance, bank_provider } = await parseRequestBody(request);
  if (!name) return jsonError("missing_fields");
  // Without "balance" in the body the balance is left alone (concurrent imports may have moved it).
  const newBalance = balance ? parseFloat(balance) : undefined;
  if (newBalance !== undefined && !Number.isFinite(newBalance)) return jsonError("invalid_balance");

  const { data, error } = await supabase
    .from("accounts")
    .update({
      name,
      icon,
      color,
      ...(newBalance !== undefined && { balance: newBalance }),
      ...(bank_provider !== undefined && { bank_provider: bank_provider || null }),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();
  if (error) return jsonServerError("crud/accounts/[id]", error);
  if (!data) return jsonError("Account not found", 404);
  return jsonResponse({ data });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { error } = await supabase.from("accounts").delete().eq("id", id).eq("user_id", user.id);
  if (error) return jsonServerError("crud/accounts/[id]", error);
  return jsonResponse({ data: { success: true } });
}
