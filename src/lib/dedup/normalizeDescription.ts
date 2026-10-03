/** Words that bank statements add around the merchant and say nothing about it. */
const NOISE_WORDS = new Set([
  "compra", "compras", "tarjeta", "pago", "pagos", "bizum", "recibo", "recibos", "transferencia", "traspaso",
  "sl", "sa", "slu", "sau", "tpv", "pos", "www", "com", "es",
  "card", "payment", "purchase", "transfer", "from", "to", "ref",
  "de", "del", "la", "el", "los", "las", "en", "con", "por", "para", "the", "and", "una", "un",
]);

/** Abbreviations the banks use for well-known merchants. */
const ALIASES: Record<string, string> = {
  amzn: "amazon",
  amz: "amazon",
  mktp: "marketplace",
  mcd: "mcdonalds",
  mcdonald: "mcdonalds",
};

/**
 * Comparable tokens of a transaction description: lowercase, no accents or punctuation, without
 * card/reference numbers (4+ digits), bank noise words and with merchant aliases applied.
 */
export function descriptionTokens(description: string | null | undefined): string[] {
  const words = (description ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/);
  const tokens = new Set<string>();
  for (const word of words) {
    if (word.length < 2 || /\d{4,}/.test(word) || NOISE_WORDS.has(word)) continue;
    tokens.add(ALIASES[word] ?? word);
  }
  return [...tokens];
}
