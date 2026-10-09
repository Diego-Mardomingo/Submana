import { getAuthedClient, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";

/** Mark every unread notification as read. */
export async function POST() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { error, count } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() }, { count: "exact" })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return jsonServerError("notifications/read-all", error);
  return jsonResponse({ data: { updated: count ?? 0 } });
}
