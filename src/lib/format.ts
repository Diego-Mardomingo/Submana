/**
 * Format a number as currency (e.g. "1.234,56 €").
 */
export function formatCurrency(
  n: number,
  options?: { locale?: string; currency?: string }
): string {
  const locale = options?.locale ?? "es-ES";
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(n);
  const currency = options?.currency ?? "€";
  return currency === "€" ? `${formatted} €` : `${formatted} ${currency}`;
}
