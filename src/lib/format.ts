const currencyFormat = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });

/** Formats a number as euros, e.g. "1.234,56 €". */
export function formatCurrency(n: number): string {
  return `${currencyFormat.format(n)} €`;
}

export const localeOf = (lang: string) => (lang === "es" ? "es-ES" : "en-US");

/** Capitalised month name for month 1-12, e.g. "Ene" / "January". */
export function monthName(month: number, lang: string, style: "short" | "long" = "short") {
  const name = new Date(2000, month - 1, 1).toLocaleDateString(localeOf(lang), { month: style }).replace(".", "");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** "Ene 2026" / "Enero 2026" style label for a "YYYY-MM" key. */
export function monthKeyLabel(key: string, lang: string, style: "short" | "long" = "short") {
  const [year, month] = key.split("-").map(Number);
  return `${monthName(month, lang, style)} ${year}`;
}
