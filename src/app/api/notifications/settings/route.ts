import { NextRequest } from "next/server";
import { getAuthedClient, jsonCachedResponse, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { DEFAULT_NOTIFICATION_SETTINGS, SETTINGS_COLUMNS, type NotificationSettings } from "@/lib/notifications/types";
import { parseSettingsPatch } from "@/lib/notifications/validation";

/** My notification settings (the defaults while I have no row yet). */
export async function GET() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { data, error } = await supabase.from("notification_settings").select(SETTINGS_COLUMNS).eq("user_id", user.id).maybeSingle();
  if (error) return jsonServerError("notifications/settings", error);
  const settings: NotificationSettings = (data as NotificationSettings | null) ?? DEFAULT_NOTIFICATION_SETTINGS;
  return jsonCachedResponse({ data: settings });
}

/** Partial update: only the fields sent change. Returns the full settings. */
export async function PUT(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const parsed = parseSettingsPatch(await request.json().catch(() => null));
  if ("error" in parsed) return jsonError(parsed.error);

  const { data, error } = await supabase
    .from("notification_settings")
    .upsert({ user_id: user.id, ...parsed.patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select(SETTINGS_COLUMNS)
    .single();
  if (error) return jsonServerError("notifications/settings", error);
  return jsonResponse({ data: data as NotificationSettings });
}
