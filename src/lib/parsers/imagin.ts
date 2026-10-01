import type { ImportedTransaction } from "./types";
import { parseCSV } from "./csv";
import { capitalizeWords, fingerprintText, parseDate, parseEuropeanNumber, toImportedTransactions, type ParseCallbacks } from "./utils";

interface ImaginRow {
  concepto: string;
  fecha: string;
  importe: number;
  saldo: number;
}

const parseAmount = (value: string | undefined) => parseEuropeanNumber(String(value ?? "").replace(/EUR/gi, "").trim());

/** Parses an imagin CSV statement (";"-separated, newest first) into rows sorted by date. */
export async function parseImaginCSV(file: File, { onProgress, onStatus }: ParseCallbacks = {}) {
  onStatus?.("Leyendo archivo CSV...");
  onProgress?.(1, 3);
  const rows = parseCSV(await file.text(), ";");
  if (rows.length < 2) throw new Error("El archivo CSV está vacío o no tiene datos");

  onStatus?.("Procesando transacciones...");
  onProgress?.(2, 3);
  const headerIdx = rows.slice(0, 10).findIndex((row) => {
    const lower = row.map((c) => c.toLowerCase().trim());
    return row.length >= 3 && ["concepto", "fecha", "importe"].every((h) => lower.includes(h));
  });
  if (headerIdx < 0) throw new Error("No se encontró la fila de cabeceras del extracto imagin");
  const headers = rows[headerIdx].map((h) => h.toLowerCase().trim());
  const [concepto, fecha, importe] = ["concepto", "fecha", "importe"].map((h) => headers.indexOf(h));
  const saldo = headers.findIndex((h) => h.includes("saldo"));

  const transactions: ImaginRow[] = [];
  for (const row of rows.slice(headerIdx + 1)) {
    if (row.length < 3) continue;
    const date = /\d{1,2}\/\d{1,2}\/\d{4}/.test(row[fecha] ?? "") ? parseDate(row[fecha]) : null;
    const amount = parseAmount(row[importe]);
    if (!date || amount === 0) continue;
    transactions.push({ concepto: (row[concepto] ?? "").trim(), fecha: date, importe: amount, saldo: saldo >= 0 ? parseAmount(row[saldo]) : 0 });
  }

  onProgress?.(3, 3);
  onStatus?.(`Encontradas ${transactions.length} transacciones`);
  // The first row is the most recent one: its balance is the current balance.
  const finalBalance = transactions[0]?.saldo;
  return { transactions: [...transactions].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()), finalBalance };
}

export function normalizeImaginTransactions(transactions: ImaginRow[], accountId: string): Promise<ImportedTransaction[]> {
  return toImportedTransactions(
    accountId,
    transactions.map((tx) => ({
      date: tx.fecha,
      signedAmount: tx.importe,
      description: tx.concepto ? capitalizeWords(tx.concepto) : "Transacción",
      fingerprint: ["imagin", fingerprintText(tx.concepto), tx.fecha, tx.importe.toFixed(2), tx.saldo.toFixed(2)].join("|"),
    }))
  );
}
