/** Server-only (service role): notification settings of arbitrary users, for `notify()` and the push sender. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lang } from "@/lib/i18n/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_NOTIFICATION_SETTINGS, SETTINGS_COLUMNS, type NotificationSettings } from "./types";

/** Settings per user; users without a row get the defaults. Throws on a database error. */
export async function loadNotificationSettings(userIds: readonly string[], admin: SupabaseClient = createAdminClient()) {
  const ids = [...new Set(userIds)];
  const settings = new Map<string, NotificationSettings>(ids.map((id) => [id, DEFAULT_NOTIFICATION_SETTINGS]));
  if (ids.length === 0) return settings;
  const { data, error } = await admin.from("notification_settings").select(`user_id, ${SETTINGS_COLUMNS}`).in("user_id", ids);
  if (error) throw error;
  for (const { user_id, ...row } of (data ?? []) as (NotificationSettings & { user_id: string })[]) settings.set(user_id, row);
  return settings;
}

/** Saved language of each user (the default when they have none). Never throws. */
export async function getUserLang(userIds: readonly string[]): Promise<Map<string, Lang>> {
  try {
    const settings = await loadNotificationSettings(userIds);
    return new Map([...settings].map(([id, s]) => [id, s.lang]));
  } catch (error) {
    console.error("[notifications] getUserLang", error);
    return new Map(userIds.map((id) => [id, DEFAULT_NOTIFICATION_SETTINGS.lang]));
  }
}
