import { calendarDayInAppTimeZone } from "@/lib/date";

/** "YYYY-MM" of a transaction date, in the app's time zone (the same month its day group shows). */
export const transactionMonthKey = (date: string) => calendarDayInAppTimeZone(date).slice(0, 7);

/** How many transactions each month ("YYYY-MM") has. */
export function monthCounts<T extends { date: string }>(transactions: readonly T[], include?: (tx: T) => boolean): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tx of transactions) {
    if (include && !include(tx)) continue;
    const key = transactionMonthKey(tx.date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Years the month picker lists: from the first one with transactions up to the current one, widened to
 * include the month being looked at (the arrows can go anywhere). Ascending.
 */
export function pickerYears(counts: ReadonlyMap<string, number>, viewedYear: number, currentYear: number): number[] {
  let first = Math.min(viewedYear, currentYear);
  for (const key of counts.keys()) first = Math.min(first, Number(key.slice(0, 4)));
  const last = Math.max(viewedYear, currentYear);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}
