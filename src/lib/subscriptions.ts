import type { Subscription } from "@/hooks/useSubscriptions";

type Schedule = Pick<Subscription, "start_date" | "end_date" | "frequency" | "frequency_value">;

const noon = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);

/** Started and not ended as of today. */
export function isSubscriptionActive(sub: Schedule) {
  const today = noon(new Date());
  return noon(new Date(sub.start_date)) <= today && !(sub.end_date && noon(new Date(sub.end_date)) < today);
}

/** Average monthly cost (weekly = 52/12 weeks per month, divided by the "every N" interval). */
export function monthlyCost(sub: Schedule & { cost: number | string }) {
  const perMonth = { weekly: 52 / 12, monthly: 1, yearly: 1 / 12 }[sub.frequency] ?? 1;
  return (Number(sub.cost) * perMonth) / (sub.frequency_value || 1);
}

/** Endless sequence of charge dates starting at the start date. */
function* chargeDates(sub: Schedule) {
  const every = sub.frequency_value || 1;
  for (let date = noon(new Date(sub.start_date)); ; ) {
    yield new Date(date);
    if (sub.frequency === "weekly") date.setDate(date.getDate() + 7 * every);
    else if (sub.frequency === "yearly") date.setFullYear(date.getFullYear() + every);
    else date.setMonth(date.getMonth() + every);
  }
}

/** Next charge after today, or null when the subscription has ended. */
export function nextPaymentDate(sub: Schedule) {
  const today = noon(new Date());
  const end = sub.end_date ? noon(new Date(sub.end_date)) : null;
  for (const date of chargeDates(sub)) {
    if (end && date > end) return null;
    if (date > today) return date;
  }
  return null;
}

/** Amount charged so far (until today or the end date). */
export function totalSpent(sub: Schedule & { cost: number | string }) {
  const today = noon(new Date());
  const end = sub.end_date && noon(new Date(sub.end_date)) < today ? noon(new Date(sub.end_date)) : today;
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
  const start = noon(new Date(sub.start_date));
  if (start > current || (sub.end_date && noon(new Date(sub.end_date)) < current)) return false;
  const every = sub.frequency_value || 1;
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
