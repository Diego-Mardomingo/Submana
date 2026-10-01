import * as XLSX from "xlsx";
import { sha256Hex } from "./importKeys";
import type { ImportedTransaction } from "./types";

export type ParseCallbacks = {
  onProgress?: (current: number, total: number) => void;
  onStatus?: (status: string) => void;
};

/** Semantic fingerprint of a transaction (date + amount + description). */
export const generateTransactionHash = (accountId: string, date: string, amount: number, description: string) =>
  sha256Hex(`${accountId}|${date}|${amount.toFixed(2)}|${description}`);

/** "1.234,56 €" → 1234.56 (0 when unparseable). */
export function parseEuropeanNumber(str: string): number {
  if (!str || typeof str !== "string") return 0;
  const value = parseFloat(str.replace(/€/g, "").replace(/\s| /g, "").replace(/\./g, "").replace(",", "."));
  return isNaN(value) ? 0 : value;
}

/** Number from a spreadsheet cell, accepting decimal commas. */
export function parseCellNumber(value: unknown): number {
  if (typeof value === "number") return isNaN(value) ? 0 : value;
  const parsed = parseFloat(String(value ?? "0").replace(",", "."));
  return isNaN(parsed) ? 0 : parsed;
}

const MONTHS: Record<string, string> = {
  // Spanish
  ene: "01", enero: "01", feb: "02", febrero: "02", mar: "03", marzo: "03", abr: "04", abril: "04",
  may: "05", mayo: "05", jun: "06", junio: "06", jul: "07", julio: "07", ago: "08", agosto: "08",
  sep: "09", sept: "09", septiembre: "09", oct: "10", octubre: "10", nov: "11", noviembre: "11",
  dic: "12", diciembre: "12",
  // German
  jan: "01", januar: "01", februar: "02", mär: "03", märz: "03", april: "04", apr: "04", mai: "05",
  juni: "06", juli: "07", aug: "08", august: "08", september: "09", okt: "10", oktober: "10",
  november: "11", dez: "12", dezember: "12",
  // English
  january: "01", february: "02", march: "03", june: "06", july: "07", october: "10", december: "12", dec: "12",
};

const pad = (n: string) => n.padStart(2, "0");

/** DD.MM.YYYY, "DD mon[.] YYYY" (es/de/en), YYYY-MM-DD or DD/MM/YYYY → YYYY-MM-DD. */
export function parseDate(dateStr: string): string | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const s = dateStr.trim();
  let m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = s.match(/(\d{1,2})\s+([a-záéíóúüñ]+)\.?\s+(\d{4})/i);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${pad(m[1])}`;
  if (/(\d{4})-(\d{2})-(\d{2})/.test(s)) return s;
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${pad(m[2])}-${pad(m[1])}` : null;
}

export const capitalizeWords = (str: string) =>
  str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/** Normalised text used inside row fingerprints. */
export const fingerprintText = (s: string) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();

/** Rows of a delimited text file (quoted fields allowed, no escaped quotes). */
export function parseDelimited(content: string, delimiter: string): string[][] {
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const cells: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') inQuotes = !inQuotes;
        else if (char === delimiter && !inQuotes) {
          cells.push(current.trim());
          current = "";
        } else current += char;
      }
      cells.push(current.trim());
      return cells;
    });
}

/** Rows of the first sheet of a spreadsheet file. */
export async function readFirstSheet(file: File): Promise<unknown[][]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
}

/**
 * Turns parsed bank rows into ImportedTransaction: sign → type, semantic hash and a source
 * fingerprint numbered per occurrence so identical rows of one statement stay distinct.
 */
export async function toImportedTransactions(
  accountId: string,
  rows: { date: string; signedAmount: number; description: string; fingerprint: string; statement_balance?: number }[]
): Promise<ImportedTransaction[]> {
  const kept = rows.filter((r) => r.signedAmount !== 0);
  const seen = new Map<string, number>();
  return Promise.all(
    kept.map(async ({ date, signedAmount, description, fingerprint, statement_balance }) => {
      const occurrence = seen.get(fingerprint) ?? 0;
      seen.set(fingerprint, occurrence + 1);
      const amount = Math.abs(signedAmount);
      return {
        date,
        amount,
        type: signedAmount > 0 ? "income" : "expense",
        description,
        external_hash: await generateTransactionHash(accountId, date, amount, description),
        import_source_fingerprint: `${fingerprint}|occ:${occurrence}`,
        ...(statement_balance !== undefined && { statement_balance }),
      } as const;
    })
  );
}
