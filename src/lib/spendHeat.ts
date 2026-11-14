/**
 * Spending intensity of each day: 0 (nothing spent) to 4. Measured against a typical day (the median
 * of the days with spending), not the month's maximum, so one big payment such as the rent doesn't
 * leave every other day looking empty.
 */
export function heatLevels(spentByDay: number[]): number[] {
  const spent = spentByDay.filter((n) => n > 0).sort((a, b) => a - b);
  if (spent.length === 0) return spentByDay.map(() => 0);
  const typical = spent[Math.floor(spent.length / 2)];
  return spentByDay.map((n) => (n <= 0 ? 0 : n < typical * 0.5 ? 1 : n < typical * 1.25 ? 2 : n < typical * 2.5 ? 3 : 4));
}
