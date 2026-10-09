import { getAuthedClient, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";

/** The user opened the inbox: the bell stops counting what exists now (the notifications stay unread). */
export async function POST() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("notification_settings")
    .upsert({ user_id: user.id, last_seen_at: now, updated_at: now }, { onConflict: "user_id" });
  if (error) return jsonServerError("notifications/seen", error);
  return jsonResponse({ data: { last_seen_at: now } });
}
