/** Cron job: on the 1st, remind people who import statements to upload last month's. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "@/lib/apiHelpers";
import type { NotifyEvent } from "../core";
import { previousMonth, type MadridClock } from "./time";

/** Day of the month the reminder goes out. */
export const IMPORT_REMINDER_DAY = 1;
/** Nothing is sent to someone who imported a statement within this window. */
export const RECENT_IMPORT_DAYS = 7;

export interface ImportedAccountRow {
  user_id: string;
  last_imported_at: string | null;
}

/**
 * Users who have imported at least once (an account of theirs has `last_imported_at`) but whose latest
 * import, across all their accounts, is older than the recent-import window. `now` is the instant of the run.
 */
export function usersToRemind(accounts: readonly ImportedAccountRow[], now: Date): string[] {
  const latest = new Map<string, number>();
  for (const { user_id, last_imported_at } of accounts) {
    const time = last_imported_at ? new Date(last_imported_at).getTime() : NaN;
    if (Number.isNaN(time)) continue;
    latest.set(user_id, Math.max(latest.get(user_id) ?? -Infinity, time));
  }
  const limit = now.getTime() - RECENT_IMPORT_DAYS * 24 * 60 * 60 * 1000;
  return [...latest].filter(([, time]) => time < limit).map(([userId]) => userId);
}

export function importReminderEvents(userIds: readonly string[], clock: Pick<MadridClock, "year" | "month" | "day">): NotifyEvent[] {
  if (clock.day !== IMPORT_REMINDER_DAY) return [];
  const { key } = previousMonth(clock);
  return userIds.map((userId) => ({ userId, type: "import.reminder", params: { month: key }, dedupeKey: `import.reminder:${key}` }));
}

export async function loadImportReminderEvents(admin: SupabaseClient, clock: MadridClock, now: Date = new Date()): Promise<NotifyEvent[]> {
  if (clock.day !== IMPORT_REMINDER_DAY) return [];
  const accounts = await fetchAllPages<ImportedAccountRow>((from, to) =>
    admin.from("accounts").select("user_id, last_imported_at").not("last_imported_at", "is", null).order("id").range(from, to)
  );
  return importReminderEvents(usersToRemind(accounts, now), clock);
}
