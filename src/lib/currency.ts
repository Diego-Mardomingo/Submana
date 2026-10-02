/** "1234,5" / "1234.5" → 1234.5 (0 when empty or invalid). */
export function parseCurrencyValue(value: string): number {
  const num = parseFloat((value || "").replace(",", "."));
  return isNaN(num) ? 0 : num;
}

/** Keeps digits and a single decimal separator; null when the edit should be rejected. */
export function sanitizeCurrencyInput(value: string): string | null {
  const next = value.replace(/[^0-9.,]/g, "");
  return next.split(/[.,]/).length - 1 <= 1 ? next : null;
}

/** "12,5" → "12,50" (unchanged when empty or invalid). */
export function normalizeCurrencyInput(value: string): string {
  return value && !isNaN(parseFloat(value.replace(",", "."))) ? parseCurrencyValue(value).toFixed(2).replace(".", ",") : value;
}
