/** Day arithmetic for the bank sync (pure and browser-safe: the account sheet suggests the start day). */
import { calendarDayInAppTimeZone } from "@/lib/date";

/** Days re-read before the last sync: late bookings land with past dates, and dedup makes re-reading harmless. */
export const RESYNC_OVERLAP_DAYS = 10;

const DAY_MS = 86_400_000;

/** YYYY-MM-DD `days` before/after `day`. */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole calendar days from `from` to `to` (both YYYY-MM-DD). */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);

/**
 * First day to ask the bank for: the configured start the first time, then the last sync minus the overlap
 * (never before the configured start).
 */
export function syncWindowStart(syncFrom: string | null, lastSyncedAt: string | null, today: string): string {
  const fromLast = lastSyncedAt ? addDays(calendarDayInAppTimeZone(lastSyncedAt), -RESYNC_OVERLAP_DAYS) : null;
  const start = syncFrom ?? addDays(today, -90);
  return fromLast && fromLast > start ? fromLast : start;
}

/**
 * Suggested first day to sync: the day after the account's latest statement line, so nothing already
 * imported from a file comes in twice; without one, the first day of the current month.
 */
export function suggestSyncFrom(latestBookedAt: string | null | undefined, today: string): string {
  if (latestBookedAt) return addDays(calendarDayInAppTimeZone(latestBookedAt), 1);
  return `${today.slice(0, 7)}-01`;
}
