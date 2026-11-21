/** Cron job: once a week, on the day each user chose, "N movements to review" when the deck has enough waiting. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "@/lib/apiHelpers";
import { merchantName, shownInDeck, type ReviewMode } from "@/lib/review/classify";
import { DEFAULT_NOTIFICATION_SETTINGS } from "../types";
import type { NotifyEvent } from "../core";
import type { MadridClock } from "./time";

export interface ReviewSettingsRow {
  user_id: string;
  review_mode: ReviewMode;
  review_day: number;
  review_min: number;
}

export interface OpenReviewRow {
  user_id: string;
  description: string | null;
  review_reason: string | null;
  subscription_id: string | null;
  account: { is_joint: boolean } | null;
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a Madrid calendar day. */
export function isoWeekday(clock: Pick<MadridClock, "year" | "month" | "day">) {
  const day = new Date(Date.UTC(clock.year, clock.month - 1, clock.day)).getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * The notifications to send today: users whose review day is today (no settings row: the default) with at least
 * their minimum of movements waiting in the deck, counted in the mode they chose. Newest movements first in `rows`.
 */
export function reviewReminderEvents(rows: readonly OpenReviewRow[], settings: readonly ReviewSettingsRow[], clock: MadridClock): NotifyEvent[] {
  const weekday = isoWeekday(clock);
  const byUser = new Map(settings.map((s) => [s.user_id, s]));
  const fallback = { review_mode: DEFAULT_NOTIFICATION_SETTINGS.review_mode, review_day: DEFAULT_NOTIFICATION_SETTINGS.review_day, review_min: DEFAULT_NOTIFICATION_SETTINGS.review_min };
  const pending = new Map<string, string[]>();
  for (const row of rows) {
    const s = byUser.get(row.user_id) ?? fallback;
    if (s.review_day !== weekday || row.account?.is_joint || !shownInDeck(row, s.review_mode)) continue;
    pending.set(row.user_id, [...(pending.get(row.user_id) ?? []), row.description ?? ""]);
  }
  const events: NotifyEvent[] = [];
  for (const [userId, descriptions] of pending) {
    const s = byUser.get(userId) ?? fallback;
    if (descriptions.length < Math.max(1, s.review_min)) continue;
    const names = [...new Set(descriptions.map(merchantName).filter(Boolean))].slice(0, 3);
    events.push({ userId, type: "review.pending", params: { count: descriptions.length, names }, dedupeKey: `review.pending:${clock.date}` });
  }
  return events;
}

export async function loadReviewReminderEvents(admin: SupabaseClient, clock: MadridClock): Promise<NotifyEvent[]> {
  const rows = await fetchAllPages<OpenReviewRow>(
    (from, to) =>
    admin
      .from("transactions")
      .select("user_id, description, review_reason, subscription_id, account:accounts(is_joint)")
      .in("review_state", ["pending", "later"])
      .order("date", { ascending: false })
      .order("id")
      .range(from, to) as unknown as PromiseLike<{ data: OpenReviewRow[] | null; error: unknown }>
  );
  if (rows.length === 0) return [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data, error } = await admin.from("notification_settings").select("user_id, review_mode, review_day, review_min").in("user_id", userIds);
  if (error) throw error;
  return reviewReminderEvents(rows, (data ?? []) as ReviewSettingsRow[], clock);
}
