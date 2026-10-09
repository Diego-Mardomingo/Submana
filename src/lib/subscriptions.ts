import type { Subscription } from "@/hooks/useSubscriptions";
import { appNow, parseDateString, shiftMonth, toDateString } from "@/lib/date";
import { RENEWAL_OFFSETS, type RenewalOffset } from "@/lib/notifications/catalog";

type Schedule = Pick<Subscription, "start_date" | "end_date" | "frequency" | "frequency_value">;

const noon = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
/** The day in Madrid (APP_TIME_ZONE) at local noon, whatever the zone of the process: the browser, or a UTC server. */
const madridToday = () => noon(appNow());
const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 12);
/** Date-only strings are local days (new Date("YYYY-MM-DD") would be UTC midnight). */
const localDay = (date: string) => noon(parseDateString(date));

/**
 * "Today" in all the functions below is the Madrid day (see `madridToday`); pass `today` to compute
 * another day (tests, the cron). Only the date matters, not the time.
 */

/** Started and not ended as of today. */
export function isSubscriptionActive(sub: Schedule, todayDate?: Date) {
  const today = noon(todayDate ?? madridToday());
  return localDay(sub.start_date) <= today && !(sub.end_date && localDay(sub.end_date) < today);
}

/** Average monthly cost (weekly = 52/12 weeks per month, divided by the "every N" interval). */
export function monthlyCost(sub: Schedule & { cost: number | string }) {
  const perMonth = { weekly: 52 / 12, monthly: 1, yearly: 1 / 12 }[sub.frequency] ?? 1;
  return (Number(sub.cost) * perMonth) / Math.max(1, sub.frequency_value || 1);
}

/**
 * Endless sequence of charge dates. Each one is computed from the start date and clamped to the
 * month's last day (Jan 31 → Feb 28/29 → Mar 31), like the calendar; adding months cumulatively
 * made the day drift (Jan 31 → Mar 3 → Apr 3).
 */
function* chargeDates(sub: Schedule) {
  const every = Math.max(1, sub.frequency_value || 1);
  const start = localDay(sub.start_date);
  for (let n = 0; ; n++) {
    if (sub.frequency === "weekly") {
      yield new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7 * every * n, 12);
      continue;
    }
    const { year, month } = shiftMonth(start.getFullYear(), start.getMonth() + 1, (sub.frequency === "yearly" ? 12 : 1) * every * n);
    yield new Date(year, month - 1, Math.min(start.getDate(), new Date(year, month, 0).getDate()), 12);
  }
}

/** Next charge after today, or null when the subscription has ended. */
export function nextPaymentDate(sub: Schedule, todayDate?: Date) {
  const today = noon(todayDate ?? madridToday());
  const end = sub.end_date ? localDay(sub.end_date) : null;
  for (const date of chargeDates(sub)) {
    if (end && date > end) return null;
    if (date > today) return date;
  }
  return null;
}

/** Amount charged so far (until today or the end date). */
export function totalSpent(sub: Schedule & { cost: number | string }, todayDate?: Date) {
  const today = noon(todayDate ?? madridToday());
  const end = sub.end_date && localDay(sub.end_date) < today ? localDay(sub.end_date) : today;
  let payments = 0;
  for (const date of chargeDates(sub)) {
    if (date > end) break;
    payments++;
  }
  return payments * Number(sub.cost);
}

/** Whether the subscription charges on the given day (month is 0-based). */
export function isPaymentDay(sub: Schedule, year: number, month: number, day: number) {
  const current = noon(new Date(year, month, day));
  const start = localDay(sub.start_date);
  if (start > current || (sub.end_date && localDay(sub.end_date) < current)) return false;
  const every = Math.max(1, sub.frequency_value || 1);
  const sameDayOfMonth = day === Math.min(start.getDate(), new Date(year, month + 1, 0).getDate());
  switch (sub.frequency) {
    case "weekly":
      return Math.round((current.getTime() - start.getTime()) / 86400000) % (7 * every) === 0;
    case "monthly":
      return ((year - start.getFullYear()) * 12 + month - start.getMonth()) % every === 0 && sameDayOfMonth;
    case "yearly":
      return (year - start.getFullYear()) % every === 0 && month === start.getMonth() && sameDayOfMonth;
    default:
      return false;
  }
}

/** Charge dates (local noon) from `from` to `to`, both included, never past the end date. */
export function chargeDatesBetween(sub: Schedule, from: Date, to: Date) {
  const start = noon(from);
  const stop = noon(to);
  const end = sub.end_date ? localDay(sub.end_date) : null;
  const dates: Date[] = [];
  for (const date of chargeDates(sub)) {
    if (date > stop || (end && date > end)) break;
    if (date >= start) dates.push(date);
  }
  return dates;
}

/** A subscription as the reminders see it: its schedule plus the days before a charge to warn on. */
export type ReminderSchedule = Schedule & { reminder_offsets?: readonly number[] | null };

const isRenewalOffset = (value: number): value is RenewalOffset => (RENEWAL_OFFSETS as readonly number[]).includes(value);

export interface RenewalReminder {
  /** Days between today and the charge. */
  offset: RenewalOffset;
  /** YYYY-MM-DD of the charge. */
  chargeDate: string;
}

/**
 * Reminders to send today: for each offset N of the subscription (0, 1, 3 or 7), the charge that happens
 * exactly N days from today, if there is one. No offsets means no reminders.
 */
export function renewalReminders(sub: ReminderSchedule, todayDate?: Date): RenewalReminder[] {
  const today = noon(todayDate ?? madridToday());
  const offsets = [...new Set(sub.reminder_offsets ?? [])].filter(isRenewalOffset).sort((a, b) => a - b);
  return offsets.flatMap((offset) => {
    const target = addDays(today, offset);
    return chargeDatesBetween(sub, target, target).length > 0 ? [{ offset, chargeDate: toDateString(target) }] : [];
  });
}

/** Days before the end date on which the "ending" notice goes out. */
export const ENDING_NOTICE_DAYS = 3;

export interface EndingNotice {
  /** YYYY-MM-DD of the end date. */
  endDate: string;
  /** A charge falls on the end date itself (otherwise the subscription just ends). */
  lastCharge: boolean;
}

/** The "ending" notice due today: the end date is exactly `ENDING_NOTICE_DAYS` days away. */
export function endingNotice(sub: Schedule, todayDate?: Date): EndingNotice | null {
  if (!sub.end_date) return null;
  const today = noon(todayDate ?? madridToday());
  const end = localDay(sub.end_date);
  if (toDateString(end) !== toDateString(addDays(today, ENDING_NOTICE_DAYS))) return null;
  return { endDate: toDateString(end), lastCharge: chargeDatesBetween(sub, end, end).length > 0 };
}
