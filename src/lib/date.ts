import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

/** Time zone used to store transaction instants (timestamptz) and to compute month boundaries. */
export const APP_TIME_ZONE = "Europe/Madrid";

/** Month `delta` months away from year/month (1-12). */
export function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** "YYYY-MM" key for year/month (1-12). */
export const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

/**
 * Half-open UTC range [start, end) covering the given calendar months (1-12) in APP_TIME_ZONE,
 * so timestamptz filters neither lose day 1 (local midnight) nor leak into the previous month.
 */
export function calendarMonthsUtcHalfOpenRange(startYear: number, startMonth: number, endYear: number, endMonth: number) {
  return {
    startIso: fromZonedTime(new Date(startYear, startMonth - 1, 1), APP_TIME_ZONE).toISOString(),
    endExclusiveIso: fromZonedTime(new Date(endYear, endMonth, 1), APP_TIME_ZONE).toISOString(),
  };
}

/** Calendar day (YYYY-MM-DD) in APP_TIME_ZONE of an ISO/timestamptz instant; aligns UI grouping with API month limits. */
export function calendarDayInAppTimeZone(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate.slice(0, 10);
  return formatInTimeZone(d, APP_TIME_ZONE, "yyyy-MM-dd");
}

/**
 * Date whose local getters (getFullYear, getMonth, getDate, getDay, getHours…) return the wall-clock
 * time in APP_TIME_ZONE regardless of the browser zone. Use it to group transactions by day/month
 * like the API does.
 */
export function toAppDate(value: string | number | Date): Date {
  return toZonedTime(value, APP_TIME_ZONE);
}

/** "Now" as wall-clock time in APP_TIME_ZONE (for the current month/day). */
export function appNow(): Date {
  return toZonedTime(new Date(), APP_TIME_ZONE);
}

/** Local-time YYYY-MM-DD (toISOString() would shift the day in UTC+ zones). */
export function toDateString(date: Date): string {
  return `${monthKey(date.getFullYear(), date.getMonth() + 1)}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Parses YYYY-MM-DD as local noon (avoids DST edge cases); strings with a time component
 * (ISO / timestamptz) are returned as that instant in APP_TIME_ZONE wall-clock time (see toAppDate),
 * so the day matches the API's.
 */
export function parseDateString(str: string): Date {
  if (!str) return new Date();
  if (str.length > 10 || str.includes("T")) {
    const parsed = new Date(str);
    if (!Number.isNaN(parsed.getTime())) return toAppDate(parsed);
  }
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}
