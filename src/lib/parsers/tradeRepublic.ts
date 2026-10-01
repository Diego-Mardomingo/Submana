import type { ImportedTransaction } from "./types";
import { capitalizeWords, fingerprintText, parseDate, parseEuropeanNumber, toImportedTransactions, type ParseCallbacks } from "./utils";

/** Cash transaction row as printed in the statement (column names from the German original). */
interface CashRow {
  datum: string;
  typ: string;
  beschreibung: string;
  zahlungseingang: string;
  zahlungsausgang: string;
  saldo: string;
}

interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

type Headers = Record<"date" | "type" | "description" | "moneyIn" | "moneyOut" | "balance", TextItem>;
type Boundaries = { date: number; type: number; description: number; moneyIn: number; moneyOut: number; headerY: number };

/** Text below this y is the page footer. */
const FOOTER_BOTTOM_BAND = 120;
const DATE_WORDS = ["FECHA", "DATUM", "DATE", "DATA"];
const TYPE_WORDS = ["TIPO", "TYP", "TYPE"];
const DESCRIPTION_WORDS = ["DESCRIPCIÓN", "DESCRIPCION", "BESCHREIBUNG", "DESCRIPTION", "DESCRIZIONE"];
const BALANCE_WORDS = ["BALANCE", "SALDO"];
const CASH_START = ["UMSATZÜBERSICHT", "TRANSAZIONI SUL CONTO", "ACCOUNT TRANSACTIONS", "TRANSACCIONES DE CUENTA"];
const CASH_END = ["BARMITTELÜBERSICHT", "CASH SUMMARY", "BALANCE OVERVIEW", "RESUMEN DE EFECTIVO", "RESUMEN DE SALDO", "SALDO DISPONIBLE"];
const SUMMARY_MARKERS = ["RESUMEN DEL BALANCE", "BALANCE OVERVIEW", "KONTOÜBERSICHT"];

const lineText = (items: TextItem[]) => items.map((item) => item.text.trim()).join(" ").toUpperCase();
const hasAny = (text: string, words: string[]) => words.some((w) => text.includes(w));

function groupByLine(items: TextItem[], tolerance = 3): TextItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextItem[][] = [];
  sorted.forEach((item, i) => {
    if (i === 0 || Math.abs(item.y - sorted[i - 1].y) > tolerance) lines.push([]);
    lines.at(-1)!.push(item);
  });
  return lines.map((line) => line.sort((a, b) => a.x - b.x));
}

/** Locates the column headers of the cash table (the header may wrap over a few lines). */
function findHeaders(items: TextItem[]): Headers | null {
  const lines = groupByLine(items);
  let header = lines.find((line) => {
    const text = lineText(line);
    return hasAny(text, DATE_WORDS) && hasAny(text, DESCRIPTION_WORDS) && hasAny(text, BALANCE_WORDS);
  });
  if (!header) {
    for (const [i, line] of lines.entries()) {
      if (!hasAny(lineText(line), DATE_WORDS) || !hasAny(lineText(line), DESCRIPTION_WORDS)) continue;
      const baseY = line[0]?.y || 0;
      const combined = [...line, ...lines.slice(i + 1, i + 4).filter((next) => Math.abs((next[0]?.y || 0) - baseY) < 30).flat()];
      if (hasAny(lineText(combined), BALANCE_WORDS)) {
        header = combined;
        break;
      }
    }
  }
  if (!header) return null;

  const find = (words: string[], startsWith = false) =>
    header.find((item) => {
      const t = item.text.trim().toUpperCase();
      return words.some((w) => (startsWith ? t.startsWith(w) : t.includes(w)));
    });
  const date = find(DATE_WORDS);
  const type = find(TYPE_WORDS);
  const description = find(DESCRIPTION_WORDS);
  const balance = find(BALANCE_WORDS);
  let moneyIn = find(["ENTRADA", "ZAHLUNGSEINGANG", "MONEY IN", "IN ENTRATA"], true);
  let moneyOut = find(["SALIDA", "ZAHLUNGSAUSGANG", "MONEY OUT", "IN USCITA"], true);
  if (!date || !description || !balance) return null;
  if (!moneyIn || !moneyOut) {
    // Unlabelled payment columns: the two remaining header items, left to right.
    const rest = header.filter((item) => ![date, type, description, balance].includes(item)).sort((a, b) => a.x - b.x);
    if (rest.length >= 2) [moneyIn, moneyOut] = rest;
  }
  return moneyIn && moneyOut && type ? { date, type, description, moneyIn, moneyOut, balance } : null;
}

/** Right edge of each column (left edge of the next header minus a margin). */
const boundariesOf = (h: Headers): Boundaries => ({
  date: h.type.x - 5,
  type: h.description.x - 5,
  description: h.moneyIn.x - 5,
  moneyIn: h.moneyOut.x - 5,
  moneyOut: h.balance.x - 5,
  headerY: h.date.y,
});

function extractRows(items: TextItem[], b: Boundaries): CashRow[] {
  const content = items.filter((item) => item.y < b.headerY - 5 && item.text.trim() !== "").sort((a, b2) => b2.y - a.y || a.x - b2.x);
  if (content.length === 0) return [];

  // A vertical gap larger than 1.5 line heights starts a new transaction.
  const gap = (content.reduce((sum, item) => sum + item.height, 0) / content.length || 10) * 1.5;
  const groups: TextItem[][] = [[content[0]]];
  for (let i = 1; i < content.length; i++) {
    if (content[i - 1].y - content[i].y > gap) groups.push([]);
    groups.at(-1)!.push(content[i]);
  }

  return groups.flatMap((group) => {
    const row: CashRow = { datum: "", typ: "", beschreibung: "", zahlungseingang: "", zahlungsausgang: "", saldo: "" };
    const amounts = group.filter((item) => {
      const column = item.x < b.date ? "datum" : item.x < b.type ? "typ" : item.x < b.description ? "beschreibung" : null;
      if (column) row[column] += " " + item.text;
      return !column;
    });
    amounts.sort((a, b2) => a.x - b2.x);
    row.saldo = amounts.pop()?.text ?? ""; // The right-most amount is the running balance.
    for (const item of amounts) {
      if (item.x < b.moneyIn) row.zahlungseingang += " " + item.text;
      else if (item.x < b.moneyOut) row.zahlungsausgang += " " + item.text;
    }
    for (const key of Object.keys(row) as (keyof CashRow)[]) row[key] = row[key].trim().replace(/\s+/g, " ");
    return Object.values(row).some(Boolean) ? [row] : [];
  });
}

const FULL_DATE_PATTERN = /\b\d{1,2}(?:\.\d{1,2}\.|\s+[a-záéíóúüñ]+\.?\s+)20\d{2}\b/gi;

/** Full dates (YYYY-MM-DD) found in a text. */
const collectFullDates = (text: string) => [...text.matchAll(FULL_DATE_PATTERN)].flatMap((m) => parseDate(m[0]) ?? []);

/**
 * Year for a date printed without one ("15 dic"): the one that keeps it inside the statement
 * period (min/max of the header's full dates), so a Dec 2025 – Jan 2026 statement doesn't put
 * January rows in 2025. Without a period, `fallbackYear`.
 */
export function pickYearForPartialDate(partialDate: string, statementDates: string[], fallbackYear: string): string {
  if (statementDates.length === 0) return fallbackYear;
  const sorted = [...statementDates].sort();
  const [periodStart, periodEnd] = [sorted[0], sorted.at(-1)!];
  for (let year = Number(periodStart.slice(0, 4)); year <= Number(periodEnd.slice(0, 4)); year++) {
    const parsed = parseDate(`${partialDate} ${year}`);
    if (parsed && parsed >= periodStart && parsed <= periodEnd) return String(year);
  }
  return fallbackYear;
}

/** Parses the cash transactions table of a Trade Republic PDF statement. */
export async function parseTradeRepublicPDF(file: File, { onProgress, onStatus }: ParseCallbacks = {}) {
  onStatus?.("Loading PDF library...");
  const pdfjs = await import("pdfjs-dist");
  // Worker served from our own bundle (same version as the library, no third-party CDN).
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  onStatus?.("Reading PDF file...");
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  onStatus?.("Parsing transactions...");

  const cash: CashRow[] = [];
  const pageTexts: string[] = [];
  let statementYear: string | undefined;
  const statementDates: string[] = [];
  let boundaries: Boundaries | null = null;
  let inCashTable = false;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    onProgress?.(pageNum, pdf.numPages);
    onStatus?.(`Processing page ${pageNum} of ${pdf.numPages}`);
    const textItems = (await (await pdf.getPage(pageNum)).getTextContent()).items.filter((item) => "str" in item);
    pageTexts.push(textItems.map((item) => item.str).join(" "));
    if (!statementYear) {
      statementYear = pageTexts.at(-1)!.match(/20\d{2}/)?.[0];
      // Full dates in the header (statement period) decide the year of "dd mmm" rows.
      if (statementYear) statementDates.push(...collectFullDates(pageTexts.at(-1)!));
    }

    const items: TextItem[] = textItems
      .map((item) => ({ text: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height }))
      .filter((item) => item.y > FOOTER_BOTTOM_BAND);

    const start: TextItem | undefined = inCashTable
      ? undefined
      : items.find((item) => {
          const t = item.text.trim().toUpperCase();
          return hasAny(t, CASH_START) || t === "TRANSACCIONES" || t === "MOVIMIENTOS" || t.startsWith("TRANSACCIONES DE") || t.startsWith("MOVIMIENTOS DE");
        });
    const end = items.find((item) => hasAny(item.text.trim(), CASH_END));
    const processCash: boolean = inCashTable || !!start;

    if (processCash) {
      const cashItems = items.filter((item) => (!start || item.y <= start.y) && (!end || item.y > end.y));
      const headers = findHeaders(cashItems);
      if (headers) boundaries = boundariesOf(headers);
      if (boundaries) {
        // Continuation pages have no header: treat everything on the page as content.
        const pageBoundaries = !headers && inCashTable && cashItems.length > 0 ? { ...boundaries, headerY: Math.max(...cashItems.map((i) => i.y)) + 50 } : boundaries;
        cash.push(...extractRows(cashItems, pageBoundaries));
      }
    }
    inCashTable = end ? false : processCash || inCashTable;
  }

  // Dates printed without a year ("05 ene") take the statement year that keeps them inside the period.
  for (const tx of cash) {
    if (!statementYear || !tx.datum || parseDate(tx.datum)) continue;
    const candidate = `${tx.datum.trim()} ${pickYearForPartialDate(tx.datum.trim(), statementDates, statementYear)}`;
    if (parseDate(candidate)) tx.datum = candidate;
  }
  onStatus?.(`Found ${cash.length} transactions`);

  // Final balance: last amount of the balance summary, else the balance of the latest row.
  let finalBalance: number | undefined;
  for (const text of [...pageTexts].reverse()) {
    const upper = text.toUpperCase();
    const starts = SUMMARY_MARKERS.map((m) => upper.indexOf(m)).filter((i) => i !== -1);
    if (starts.length === 0) continue;
    const summary = text.slice(Math.min(...starts)).split(/NOTAS SOBRE EL EXTRACTO DE CUENTA/i)[0];
    const amounts = summary.match(/(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*€/g);
    if (amounts) {
      finalBalance = parseEuropeanNumber(amounts.at(-1)!);
      break;
    }
  }
  if (finalBalance === undefined) {
    const latest = [...cash].sort((a, b) => (parseDate(b.datum) ?? "").localeCompare(parseDate(a.datum) ?? ""))[0];
    if (latest?.saldo) finalBalance = parseEuropeanNumber(latest.saldo);
  }

  return { cash, finalBalance };
}

/** Readable description from Trade Republic's type + description columns. */
function describe(rawDescription: string, type: string): string {
  const text = `${type} ${rawDescription}`.trim().replace(/null$/g, "").replace(/\s{2,}/g, " ").trim();
  const merchant = (name: string) =>
    capitalizeWords(name.replace(/null$/g, "").replace(/\s{2,}/g, " ").trim().replace(/\*\s*[A-Z0-9]+$/i, "").replace(/\s+\d{4,}$/, "").trim());

  if (/\(\+34[-.]?(\d{9})\)|\+34[-.]?(\d{9})/.test(text)) {
    const bizum = text.match(/(?:outgoing\s+transfer\s+for|incoming\s+transfer\s+from)\s+([^(+]+)/i);
    if (bizum) return `Bizum - ${capitalizeWords(bizum[1].trim())}`;
  }
  const transfer =
    text.match(/(?:transferencia\s+)?incoming\s+transfer\s+from\s+([^(]+?)(?:\s*\([^)]+\))?$/i) ?? text.match(/(?:transferencia\s+)?outgoing\s+transfer\s+for\s+([^(+]+)/i);
  if (transfer) return `Transferencia - ${capitalizeWords(transfer[1].trim())}`;
  if (/^transacci[oó]n\s+con\s+tarjeta\s+/i.test(text)) {
    const name = text.replace(/^transacci[oó]n\s+con\s+tarjeta\s+/i, "").trim();
    return name ? merchant(name) : "Pago con tarjeta";
  }
  if (/interest\s+payment/i.test(text) || /^inter[eé]s\s+interest/i.test(text)) return "Intereses";
  if (/^bonificaci[oó]n/i.test(text)) return /saveback/i.test(text) ? "Saveback" : /cash\s+reward/i.test(text) ? "Recompensa" : "Bonificación";
  if (/savings\s+plan\s+execution/i.test(text) || /^operar\s+savings/i.test(text)) {
    const isin = text.match(/([A-Z]{2}[A-Z0-9]{10})/);
    return isin ? `Inversión ETF - ${isin[1]}` : "Inversión ETF";
  }
  if (rawDescription && !/^(interest|incoming|outgoing|savings)/i.test(rawDescription)) return merchant(rawDescription);
  if (type && !/^(transferencia|transacci[oó]n|operar|inter[eé]s|bonificaci[oó]n)/i.test(type)) return capitalizeWords(type);
  return text ? capitalizeWords(text) : "Transacción";
}

export function normalizeTradeRepublicTransactions(rows: CashRow[], accountId: string): Promise<ImportedTransaction[]> {
  return toImportedTransactions(
    accountId,
    rows.flatMap((tx) => {
      const date = parseDate(tx.datum);
      const moneyIn = parseEuropeanNumber(tx.zahlungseingang);
      const moneyOut = parseEuropeanNumber(tx.zahlungsausgang);
      if (!date || (moneyIn === 0 && moneyOut === 0)) return [];
      return {
        date,
        signedAmount: moneyIn > 0 ? moneyIn : -moneyOut,
        description: describe(tx.beschreibung.trim(), tx.typ.trim()),
        fingerprint: ["trade_republic", ...[tx.datum, tx.typ, tx.beschreibung, tx.zahlungseingang, tx.zahlungsausgang, tx.saldo].map(fingerprintText)].join("|"),
      };
    })
  );
}
