/** Cron job: notifications older than the retention period are deleted. */
import type { SupabaseClient } from "@supabase/supabase-js";

export const RETENTION_DAYS = 90;

export const retentionCutoff = (now: Date = new Date()) => new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

/** Returns how many notifications were deleted. Throws on a database error. */
export async function cleanupNotifications(admin: SupabaseClient, now: Date = new Date()): Promise<number> {
  const { count, error } = await admin.from("notifications").delete({ count: "exact" }).lt("created_at", retentionCutoff(now));
  if (error) throw error;
  return count ?? 0;
}
