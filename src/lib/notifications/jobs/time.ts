/** Madrid clock for the scheduled jobs (pure: the process zone, UTC on Vercel, never matters). */
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIME_ZONE, monthKey, shiftMonth } from "@/lib/date";

/** The hour (Madrid) at which notifications go out; the cron runs at 15:00 and 16:00 UTC to cover summer and winter time. */
export const SEND_HOUR = 17;

export interface MadridClock {
  /** YYYY-MM-DD */
  date: string;
  hour: number;
  year: number;
  /** 1-12 */
  month: number;
  day: number;
  /** The day at local noon, as `src/lib/subscriptions.ts` expects it. */
  today: Date;
}

export function madridClock(now: Date = new Date()): MadridClock {
  const [date, hour] = formatInTimeZone(now, APP_TIME_ZONE, "yyyy-MM-dd H").split(" ");
  const [year, month, day] = date.split("-").map(Number);
  return { date, hour: Number(hour), year, month, day, today: new Date(year, month - 1, day, 12) };
}

export const isSendHour = (clock: MadridClock) => clock.hour === SEND_HOUR;

/** The month before the clock's one. */
export function previousMonth(clock: Pick<MadridClock, "year" | "month">) {
  const { year, month } = shiftMonth(clock.year, clock.month, -1);
  return { year, month, key: monthKey(year, month) };
}
