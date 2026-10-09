import { getAuthedClient, jsonCachedResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import type { NotificationCounts } from "@/lib/notifications/types";

/** Unread notifications and the ones the bell rings for (unread and newer than the last time the inbox was opened). */
export async function GET() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const unreadQuery = () => supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  const [unread, settings] = await Promise.all([
    unreadQuery(),
    supabase.from("notification_settings").select("last_seen_at").eq("user_id", user.id).maybeSingle(),
  ]);
  if (unread.error) return jsonServerError("notifications/counts", unread.error);
  if (settings.error) return jsonServerError("notifications/counts", settings.error);

  const lastSeen = settings.data?.last_seen_at as string | null | undefined;
  let unseen = unread.count ?? 0;
  if (lastSeen && unseen > 0) {
    const { count, error } = await unreadQuery().gt("created_at", lastSeen);
    if (error) return jsonServerError("notifications/counts", error);
    unseen = count ?? 0;
  }
  const data: NotificationCounts = { unread: unread.count ?? 0, unseen };
  return jsonCachedResponse({ data });
}
