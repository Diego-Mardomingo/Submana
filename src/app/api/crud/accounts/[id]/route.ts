import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, parseRequestBody, unauthorized } from "@/lib/apiHelpers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { name, icon, color, balance, bank_provider } = await parseRequestBody(request);
  if (!name) return jsonError("missing_fields");

  const { data, error } = await supabase
    .from("accounts")
    .update({
      name,
      balance: parseFloat(balance || "0"),
      icon,
      color,
      ...(bank_provider !== undefined && { bank_provider: bank_provider || null }),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();
  if (error) return jsonError(error.message, 500);
  return jsonResponse({ data });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { error } = await supabase.from("accounts").delete().eq("id", id).eq("user_id", user.id);
  if (error) return jsonError(error.message, 500);
  return jsonResponse({ data: { success: true } });
}
