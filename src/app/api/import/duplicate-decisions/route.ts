import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, jsonServerError, parseRequestBody, unauthorized } from "@/lib/apiHelpers";

export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { account_id, conflict_key, resolution } = await parseRequestBody(request);
  if (!account_id || !conflict_key || !resolution) return jsonError("missing account_id, conflict_key or resolution");
  if (resolution !== "keep_existing" && resolution !== "keep_import") return jsonError("invalid resolution");

  const { data: account } = await supabase.from("accounts").select("id").eq("id", account_id).eq("user_id", user.id).single();
  if (!account) return jsonError("Account not found", 404);

  const { data, error } = await supabase
    .from("import_duplicate_decisions")
    .upsert({ user_id: user.id, account_id, conflict_key, resolution }, { onConflict: "user_id,account_id,conflict_key" })
    .select()
    .single();
  if (error) return jsonServerError("import/duplicate-decisions", error);
  return jsonResponse({ data });
}

export async function DELETE(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const accountId = request.nextUrl.searchParams.get("account_id");
  const conflictKey = request.nextUrl.searchParams.get("conflict_key");
  if (!accountId || !conflictKey) return jsonError("missing account_id or conflict_key");

  const { error } = await supabase
    .from("import_duplicate_decisions")
    .delete()
    .eq("user_id", user.id)
    .eq("account_id", accountId)
    .eq("conflict_key", conflictKey);
  if (error) return jsonServerError("import/duplicate-decisions", error);
  return jsonResponse({ data: { success: true } });
}
