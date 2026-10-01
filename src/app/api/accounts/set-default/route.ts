import { createClient } from "@/lib/supabase/server";
import { isOwnedAccount, jsonError, jsonServerError, jsonResponse, parseRequestBody } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  const { body } = await parseRequestBody(request);
  const id = body.id;

  if (!id) {
    return jsonError("missing_id");
  }

  if (!(await isOwnedAccount(supabase, user.id, id))) {
    return jsonError("Account not found", 404);
  }

  const { error: resetError } = await supabase
    .from("accounts")
    .update({ is_default: false })
    .eq("user_id", user.id);

  if (resetError) {
    return jsonServerError("/api/accounts/set-default", resetError);
  }

  const { error } = await supabase
    .from("accounts")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return jsonServerError("/api/accounts/set-default", error);
  }

  return jsonResponse({ data: { success: true } });
}
