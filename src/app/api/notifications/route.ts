import { getAuthedClient, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";

export async function GET() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { data, error } = await supabase
    .from("automation_notifications")
    .select("id, success, transaction_id, error_message, amount, description, account_id, created_at, accounts(name, color)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return jsonServerError("notifications", error);
  return jsonResponse({ data });
}
