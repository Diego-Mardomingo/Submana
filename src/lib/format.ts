const currencyFormat = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });

/** Formats a number as euros, e.g. "1.234,56 €". */
export function formatCurrency(n: number): string {
  return `${currencyFormat.format(n)} €`;
}

const wholeFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: true });

/** Rounded to whole euros with its sign, for tight spots: "+1.110 €", "-640 €", "0 €". */
export function formatSignedWhole(n: number): string {
  const rounded = Math.round(n);
  if (rounded === 0) return "0 €";
  return `${rounded > 0 ? "+" : "-"}${wholeFormat.format(Math.abs(rounded))} €`;
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
