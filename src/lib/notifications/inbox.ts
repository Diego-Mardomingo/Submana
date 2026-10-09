/** Pure helpers of the inbox: day grouping and time labels (Madrid time, like the rest of the app). */
import { APP_TIME_ZONE, calendarDayInAppTimeZone } from "@/lib/date";

export type DayGroupKey = "today" | "yesterday" | "thisWeek" | "earlier";

export const DAY_GROUP_ORDER: DayGroupKey[] = ["today", "yesterday", "thisWeek", "earlier"];

const DAY_MS = 86_400_000;

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function dayDiff(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
}

/** Days between the Madrid calendar day of `iso` and the one of `now` (0 = same day). */
export const ageInDays = (iso: string, now: Date = new Date()) => dayDiff(calendarDayInAppTimeZone(iso), calendarDayInAppTimeZone(now.toISOString()));

/** Today, yesterday, the rest of the last 7 days, or older. Dates in the future count as today. */
export function dayGroupOf(iso: string, now: Date = new Date()): DayGroupKey {
  const age = ageInDays(iso, now);
  if (age <= 0) return "today";
  if (age === 1) return "yesterday";
  if (age <= 6) return "thisWeek";
  return "earlier";
}

/** Groups in display order (empty ones are left out); items keep their order within each group. */
export function groupByDay<T extends { created_at: string }>(items: readonly T[], now: Date = new Date()): { key: DayGroupKey; items: T[] }[] {
  const buckets = new Map<DayGroupKey, T[]>();
  for (const item of items) {
    const key = dayGroupOf(item.created_at, now);
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  }
  return DAY_GROUP_ORDER.filter((key) => buckets.has(key)).map((key) => ({ key, items: buckets.get(key)! }));
}

/** "17:00" for today and yesterday, the weekday for the rest of the week and "12 oct" for older ones. */
export function notificationTimeLabel(iso: string, group: DayGroupKey, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const options: Intl.DateTimeFormatOptions =
    group === "today" || group === "yesterday"
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : group === "thisWeek"
        ? { weekday: "short" }
        : { day: "numeric", month: "short" };
  return date.toLocaleString(locale, { ...options, timeZone: APP_TIME_ZONE }).replace(".", "");
}
