import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonServerError, jsonResponse } from "@/lib/apiHelpers";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  const { data: notifications, error } = await supabase
    .from("automation_notifications")
    .select(
      `
      id,
      success,
      transaction_id,
      error_message,
      amount,
      description,
      account_id,
      created_at,
      accounts(name, color)
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return jsonServerError("/api/notifications", error);
  }

  return jsonResponse({ data: notifications ?? [] }, 200);
}
