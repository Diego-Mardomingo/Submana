import { monthKey, shiftMonth } from "@/lib/date";

export type MonthBalance = { key: string; income: number; expense: number; net: number; hasData: boolean };

/** Where a cell of the calendar-aligned grid falls: before the history, in it, or after the current month. */
export type GridCell = { key: string; month: number; year: number; place: "before" | "history" | "future" };

/** Every month ("YYYY-MM") from the first one with transactions to the current one, both included. */
export function historyMonths(keysWithData: readonly string[], current: { year: number; month: number }): string[] {
  const currentKey = monthKey(current.year, current.month);
  const first = keysWithData.reduce<string | null>((min, key) => (key <= currentKey && (!min || key < min) ? key : min), null);
  if (!first) return [];
  const [year, month] = first.split("-").map(Number);
  const keys: string[] = [];
  for (let i = 0; ; i++) {
    const next = shiftMonth(year, month, i);
    const key = monthKey(next.year, next.month);
    if (key > currentKey) break;
    keys.push(key);
  }
  return keys;
}

/** Income, expense and result of each month; `totalsOf` sums the month's (metric) transactions. */
export function monthlyBalances(
  keys: readonly string[],
  totalsOf: (key: string) => { income: number; expense: number; count: number }
): MonthBalance[] {
  return keys.map((key) => {
    const { income, expense, count } = totalsOf(key);
    return { key, income, expense, net: income - expense, hasData: count > 0 };
  });
}

/** Totals of the months with data: what was saved, the monthly average and how many ended up or down. */
export function balanceSummary(months: readonly MonthBalance[]) {
  const withData = months.filter((m) => m.hasData);
  const total = withData.reduce((sum, m) => sum + m.net, 0);
  return {
    total,
    average: withData.length ? total / withData.length : 0,
    months: withData.length,
    positive: withData.filter((m) => m.net > 0).length,
    negative: withData.filter((m) => m.net < 0).length,
    empty: months.length - withData.length,
  };
}

/** How strong a month's tint is (0.15-1): its result against the biggest one, so small months still show a colour. */
export function tintStrength(net: number, months: readonly MonthBalance[]): number {
  const max = months.reduce((m, b) => Math.max(m, Math.abs(b.net)), 0);
  if (max === 0 || net === 0) return 0;
  return Math.max(0.15, Math.abs(net) / max);
}

/**
 * Cells of a grid aligned to the calendar: from January of the first year of the history to December of the
 * last one, so each row is a quarter (4 columns), a half (6) or a year (12).
 */
export function calendarGrid(keys: readonly string[]): GridCell[] {
  if (keys.length === 0) return [];
  const first = keys[0];
  const last = keys[keys.length - 1];
  const [firstYear, lastYear] = [Number(first.slice(0, 4)), Number(last.slice(0, 4))];
  const cells: GridCell[] = [];
  for (let year = firstYear; year <= lastYear; year++) {
    for (let month = 1; month <= 12; month++) {
      const key = monthKey(year, month);
      cells.push({ key, year, month, place: key < first ? "before" : key > last ? "future" : "history" });
    }
  }
  return cells;
}
