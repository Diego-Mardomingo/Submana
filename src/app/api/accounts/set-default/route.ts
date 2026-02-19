import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse, parseRequestBody } from "@/lib/apiHelpers";
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

  await supabase
    .from("accounts")
    .update({ is_default: false })
    .eq("user_id", user.id);

  const { error } = await supabase
    .from("accounts")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonResponse({ data: { success: true } });
}
