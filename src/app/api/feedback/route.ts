import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse, parseRequestBody } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";

const ALLOWED_TYPES = ["error", "suggestion"] as const;

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
  const type = body.type;
  const message = (body.message || "").trim();

  if (!type || !ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number])) {
    return jsonError("type must be 'error' or 'suggestion'", 400);
  }

  if (!message) {
    return jsonError("message is required", 400);
  }

  const { data: insertedData, error } = await supabase
    .from("feedback")
    .insert({ user_id: user.id, type, message })
    .select()
    .single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonResponse({ data: insertedData }, 201);
}
