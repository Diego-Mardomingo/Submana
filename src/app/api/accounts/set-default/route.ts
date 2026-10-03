import { NextRequest } from "next/server";
import { getAccountAccess, getAuthedClient, jsonError, jsonResponse, jsonServerError, parseRequestBody, unauthorized } from "@/lib/apiHelpers";

export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { id } = await parseRequestBody(request);
  if (!id) return jsonError("missing_id");

  if ((await getAccountAccess(supabase, user.id, id))?.role !== "owner") return jsonError("Account not found", 404);

  const { error: resetError } = await supabase.from("accounts").update({ is_default: false }).eq("user_id", user.id);
  if (resetError) return jsonServerError("accounts/set-default", resetError);
  const { error } = await supabase.from("accounts").update({ is_default: true }).eq("id", id).eq("user_id", user.id);
  if (error) return jsonServerError("accounts/set-default", error);
  return jsonResponse({ data: { success: true } });
}
