import type { ImportedTransaction } from "./types";
import { capitalizeWords, fingerprintText, parseCellNumber, parseDate, readFirstSheet, toImportedTransactions, type ParseCallbacks } from "./utils";

interface BBVARow {
  fecha: string;
  concepto: string;
  movimiento: string;
  importe: number;
  disponible: number;
}

const findHeaderRow = (rows: unknown[][]) =>
  rows.slice(0, 20).findIndex((row) => {
    const text = (Array.isArray(row) ? row : []).map((c) => String(c ?? "").toLowerCase()).join(" ");
    return text.includes("fecha valor") || (text.includes("fecha") && text.includes("concepto") && text.includes("importe"));
  });

/** "Fecha" is the transaction date; "Fecha valor" is only a fallback. */
function columnIndices(headers: unknown[]) {
  const lower = headers.map((h) => String(h ?? "").toLowerCase().trim());
  const at = (name: string) => lower.indexOf(name);
  const concepto = at("concepto");
  const importe = at("importe");
  if (concepto < 0 || importe < 0) return null;
  const valueDate = lower.findIndex((h) => h.includes("fecha valor") || h === "f.valor" || h === "f. valor");
  const fecha = at("fecha") >= 0 ? at("fecha") : valueDate >= 0 ? valueDate : concepto - 2;
  return { fecha, concepto, movimiento: at("movimiento"), importe, disponible: at("disponible") };
}

/** Parses a BBVA account report (Excel) into rows sorted by date. */
export async function parseBBVAExcel(file: File, { onProgress, onStatus }: ParseCallbacks = {}) {
  onStatus?.("Leyendo archivo Excel...");
  onProgress?.(1, 3);
  const rows = await readFirstSheet(file);
  if (rows.length < 2) throw new Error("El archivo Excel está vacío o no tiene datos");

  onStatus?.("Procesando transacciones...");
  onProgress?.(2, 3);
  const headerIdx = findHeaderRow(rows);
  if (headerIdx < 0) throw new Error("No se encontró la fila de cabeceras del informe BBVA");
  const cols = columnIndices(rows[headerIdx]);
  if (!cols) throw new Error("No se pudieron identificar las columnas del Excel BBVA");

  const transactions: BBVARow[] = [];
  for (const row of rows.slice(headerIdx + 1)) {
    if (!Array.isArray(row)) continue;
    const text = (i: number) => (row[i] == null ? "" : String(row[i]).trim());
    const fecha = text(cols.fecha).match(/\d{1,2}\/\d{1,2}\/\d{4}/) && parseDate(text(cols.fecha));
    const importe = parseCellNumber(row[cols.importe]);
    if (!fecha || importe === 0) continue;
    const disponible = cols.disponible >= 0 ? parseCellNumber(row[cols.disponible]) : 0;
    transactions.push({ fecha, concepto: text(cols.concepto), movimiento: text(cols.movimiento), importe, disponible });
  }

  onProgress?.(3, 3);
  onStatus?.(`Encontradas ${transactions.length} transacciones`);
  const finalBalance = findFinalBalance(transactions);
  transactions.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  return { transactions, finalBalance };
}

/**
 * Balance after the last movement of the last day, regardless of file order: it is the only one
 * whose "disponible" is not the previous balance of another movement that day.
 */
export function findFinalBalance(transactions: Pick<BBVARow, "fecha" | "importe" | "disponible">[]): number | undefined {
  if (transactions.length === 0) return undefined;
  const lastDay = transactions.reduce((max, tx) => (tx.fecha > max ? tx.fecha : max), transactions[0].fecha);
  const sameDay = transactions.filter((tx) => tx.fecha === lastDay);
  const cents = (n: number) => Math.round(n * 100);
  const previousBalances = new Set(sameDay.map((tx) => cents(tx.disponible - tx.importe)));
  const last = sameDay.filter((tx) => !previousBalances.has(cents(tx.disponible)));
  // When the chain is ambiguous, BBVA exports the most recent movement first.
  return (last.length === 1 ? last[0] : sameDay[0]).disponible;
}

function describe({ concepto, movimiento }: BBVARow) {
  if (concepto && movimiento && concepto !== movimiento) return `${capitalizeWords(concepto)} - ${capitalizeWords(movimiento)}`;
  return movimiento || concepto ? capitalizeWords(movimiento || concepto) : "Transacción";
}

export function normalizeBBVATransactions(transactions: BBVARow[], accountId: string): Promise<ImportedTransaction[]> {
  return toImportedTransactions(
    accountId,
    transactions.map((tx) => ({
      date: tx.fecha,
      signedAmount: tx.importe,
      description: describe(tx),
      fingerprint: ["bbva", tx.fecha, fingerprintText(tx.concepto), fingerprintText(tx.movimiento), tx.importe.toFixed(2), tx.disponible.toFixed(2)].join("|"),
    }))
  );
}
