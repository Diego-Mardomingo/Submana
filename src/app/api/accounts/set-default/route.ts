import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, parseRequestBody, unauthorized } from "@/lib/apiHelpers";

export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { id } = await parseRequestBody(request);
  if (!id) return jsonError("missing_id");

  await supabase.from("accounts").update({ is_default: false }).eq("user_id", user.id);
  const { error } = await supabase.from("accounts").update({ is_default: true }).eq("id", id).eq("user_id", user.id);
  if (error) return jsonError(error.message, 500);
  return jsonResponse({ data: { success: true } });
}
