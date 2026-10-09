import { NextRequest } from "next/server";
import { getAuthedClient, jsonCachedResponse, jsonError, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { NOTIFICATION_COLUMNS, type NotificationItem, type NotificationRow, type NotificationsPage } from "@/lib/notifications/types";
import { fetchProfiles } from "@/lib/shared/server";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

/** My notifications, newest first, paginated by `created_at` (`before` = the previous page's `nextBefore`). */
export async function GET(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const params = request.nextUrl.searchParams;
  const filter = params.get("filter") ?? "all";
  if (filter !== "unread" && filter !== "all") return jsonError("invalid_filter");
  const before = params.get("before");
  if (before && Number.isNaN(Date.parse(before))) return jsonError("invalid_before");
  const requested = Number(params.get("limit") ?? DEFAULT_LIMIT);
  if (!Number.isInteger(requested) || requested < 1) return jsonError("invalid_limit");
  const limit = Math.min(requested, MAX_LIMIT);

  let query = supabase
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (filter === "unread") query = query.is("read_at", null);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) return jsonServerError("notifications", error);

  const rows = (data ?? []) as NotificationRow[];
  const page = rows.slice(0, limit);
  const profiles = await fetchProfiles(
    supabase,
    page.flatMap((row) => (row.actor_id ? [row.actor_id] : []))
  );
  const items: NotificationItem[] = page.map((row) => {
    const profile = row.actor_id ? profiles.get(row.actor_id) : undefined;
    return {
      id: row.id,
      type: row.type,
      actor_id: row.actor_id,
      actor: profile ? { handle: profile.handle, display_name: profile.display_name, avatar_url: profile.avatar_url } : null,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      params: row.params as Record<string, unknown>,
      url: row.url,
      created_at: row.created_at,
      read_at: row.read_at,
    };
  });
  const result: NotificationsPage = { items, nextBefore: rows.length > limit ? page[page.length - 1].created_at : null };
  return jsonCachedResponse({ data: result });
}
