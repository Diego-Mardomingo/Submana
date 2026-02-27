import type { ImportedTransaction, TradeRepublicCashTransaction } from "./types";

export async function generateTransactionHash(
  accountId: string,
  date: string,
  amount: number,
  description: string
): Promise<string> {
  const data = `${accountId}|${date}|${amount.toFixed(2)}|${description}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function parseEuropeanNumber(str: string): number {
  if (!str || typeof str !== "string") return 0;
  const cleanStr = str
    .replace(/€/g, "")
    .replace(/\s|\u202f/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const value = parseFloat(cleanStr);
  return isNaN(value) ? 0 : value;
}

const SPANISH_MONTHS: Record<string, string> = {
  ene: "01", enero: "01",
  feb: "02", febrero: "02",
  mar: "03", marzo: "03",
  abr: "04", abril: "04",
  may: "05", mayo: "05",
  jun: "06", junio: "06",
  jul: "07", julio: "07",
  ago: "08", agosto: "08",
  sep: "09", sept: "09", septiembre: "09",
  oct: "10", octubre: "10",
  nov: "11", noviembre: "11",
  dic: "12", diciembre: "12",
};

const GERMAN_MONTHS: Record<string, string> = {
  jan: "01", januar: "01",
  feb: "02", februar: "02",
  mär: "03", märz: "03", mar: "03",
  apr: "04", april: "04",
  mai: "05",
  jun: "06", juni: "06",
  jul: "07", juli: "07",
  aug: "08", august: "08",
  sep: "09", sept: "09", september: "09",
  okt: "10", oktober: "10",
  nov: "11", november: "11",
  dez: "12", dezember: "12",
};

const ENGLISH_MONTHS: Record<string, string> = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", sept: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12",
};

export function parseDate(dateStr: string): string | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  
  const trimmed = dateStr.trim();
  
  // Format: DD.MM.YYYY (German numeric)
  const numericMatch = trimmed.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (numericMatch) {
    const [, day, month, year] = numericMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  
  // Format: DD mon YYYY or DD mon. YYYY (Spanish/German/English with month name)
  const monthNameMatch = trimmed.match(/(\d{1,2})\s+([a-záéíóúüñ]+)\.?\s+(\d{4})/i);
  if (monthNameMatch) {
    const [, day, monthName, year] = monthNameMatch;
    const monthLower = monthName.toLowerCase();
    
    const month = SPANISH_MONTHS[monthLower] || GERMAN_MONTHS[monthLower] || ENGLISH_MONTHS[monthLower];
    
    if (month) {
      return `${year}-${month}-${day.padStart(2, "0")}`;
    }
  }
  
  // Format: YYYY-MM-DD (ISO)
  const isoMatch = trimmed.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return trimmed;
  }
  
  // Format: DD/MM/YYYY
  const slashMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  
  return null;
}

export function parseGermanDate(dateStr: string): string | null {
  return parseDate(dateStr);
}

export function normalizeDescription(rawDescription: string, type: string): string {
  const combined = `${type} ${rawDescription}`.trim();
  
  let text = combined
    .replace(/null$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  
  const phoneInText = text.match(/\(\+34[-.]?(\d{9})\)|\+34[-.]?(\d{9})/);
  if (phoneInText) {
    const bizumMatch = text.match(/(?:outgoing\s+transfer\s+for|incoming\s+transfer\s+from)\s+([^(+]+)/i);
    if (bizumMatch) {
      const name = bizumMatch[1].trim();
      return `Bizum - ${capitalizeWords(name)}`;
    }
  }
  
  const incomingMatch = text.match(/(?:transferencia\s+)?incoming\s+transfer\s+from\s+([^(]+?)(?:\s*\([^)]+\))?$/i);
  if (incomingMatch) {
    const name = incomingMatch[1].trim();
    return `Transferencia - ${capitalizeWords(name)}`;
  }
  
  const outgoingMatch = text.match(/(?:transferencia\s+)?outgoing\s+transfer\s+for\s+([^(+]+)/i);
  if (outgoingMatch) {
    const name = outgoingMatch[1].trim();
    return `Transferencia - ${capitalizeWords(name)}`;
  }
  
  if (text.match(/^transacci[oó]n\s+con\s+tarjeta\s+/i)) {
    const merchant = text.replace(/^transacci[oó]n\s+con\s+tarjeta\s+/i, "").trim();
    if (merchant) {
      return cleanMerchantName(merchant);
    }
    return "Pago con tarjeta";
  }
  
  if (text.match(/interest\s+payment/i) || text.match(/^inter[eé]s\s+interest/i)) {
    return "Intereses";
  }
  
  if (text.match(/^bonificaci[oó]n/i)) {
    if (text.match(/saveback/i)) {
      return "Saveback";
    }
    if (text.match(/cash\s+reward/i)) {
      return "Recompensa";
    }
    return "Bonificación";
  }
  
  if (text.match(/savings\s+plan\s+execution/i) || text.match(/^operar\s+savings/i)) {
    const tickerMatch = text.match(/([A-Z]{2}[A-Z0-9]{10})/);
    if (tickerMatch) {
      return `Inversión ETF - ${tickerMatch[1]}`;
    }
    return "Inversión ETF";
  }
  
  if (rawDescription && !rawDescription.match(/^(interest|incoming|outgoing|savings)/i)) {
    return cleanMerchantName(rawDescription);
  }
  
  if (type && !type.match(/^(transferencia|transacci[oó]n|operar|inter[eé]s|bonificaci[oó]n)/i)) {
    return capitalizeWords(type);
  }
  
  return text ? capitalizeWords(text) : "Transacción";
}

function cleanMerchantName(name: string): string {
  let cleaned = name
    .replace(/null$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  
  cleaned = cleaned
    .replace(/\*\s*[A-Z0-9]+$/i, "")
    .replace(/\s+\d{4,}$/, "")
    .trim();
  
  return capitalizeWords(cleaned);
}

function capitalizeWords(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function normalizeTradeRepublicTransaction(
  tx: TradeRepublicCashTransaction,
  accountId: string
): Omit<ImportedTransaction, "external_hash"> | null {
  const dateStr = parseGermanDate(tx.datum);
  if (!dateStr) return null;

  const eingang = parseEuropeanNumber(tx.zahlungseingang);
  const ausgang = parseEuropeanNumber(tx.zahlungsausgang);

  if (eingang === 0 && ausgang === 0) return null;

  const isIncome = eingang > 0;
  const amount = isIncome ? eingang : ausgang;
  const rawDescription = tx.beschreibung.trim();
  const type = tx.typ.trim();
  const description = normalizeDescription(rawDescription, type);
  
  return {
    date: dateStr,
    amount,
    type: isIncome ? "income" : "expense",
    description,
  };
}

export async function normalizeAndHashTransactions(
  transactions: TradeRepublicCashTransaction[],
  accountId: string
): Promise<ImportedTransaction[]> {
  const result: ImportedTransaction[] = [];

  for (const tx of transactions) {
    const normalized = normalizeTradeRepublicTransaction(tx, accountId);
    if (!normalized) continue;

    const hash = await generateTransactionHash(
      accountId,
      normalized.date,
      normalized.amount,
      normalized.description
    );

    result.push({
      ...normalized,
      external_hash: hash,
    });
  }

  return result;
}
