import type { ImportedTransaction } from "./types";
import { generateTransactionHash, parseEuropeanNumber } from "./utils";

interface ImaginRawTransaction {
  concepto: string;
  fecha: string;
  importe: number;
  saldo: number;
}

interface ParseImaginOptions {
  onProgress?: (current: number, total: number) => void;
  onStatus?: (status: string) => void;
}

export interface ParsedImaginResult {
  transactions: ImaginRawTransaction[];
  finalBalance?: number;
}

function parseCSV(content: string, delimiter = ";"): string[][] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  return lines.map((line) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
}

function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;
    const lower = row.map((c) => String(c ?? "").toLowerCase().trim());
    if (
      lower.includes("concepto") &&
      lower.includes("fecha") &&
      lower.includes("importe")
    ) {
      return i;
    }
  }
  return -1;
}

function parseImaginDate(value: string): string | null {
  const str = String(value ?? "").trim();
  const match = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return null;
}

function parseAmount(value: string): number {
  const cleaned = String(value ?? "").replace(/EUR/gi, "").trim();
  return parseEuropeanNumber(cleaned);
}

function capitalizeWords(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeDescription(concepto: string): string {
  const trimmed = (concepto || "").trim();
  return trimmed ? capitalizeWords(trimmed) : "Transacción";
}

export async function parseImaginCSV(
  file: File,
  options?: ParseImaginOptions
): Promise<ParsedImaginResult> {
  const { onProgress, onStatus } = options ?? {};

  onStatus?.("Leyendo archivo CSV...");
  onProgress?.(1, 3);

  const text = await file.text();
  const rows = parseCSV(text, ";");

  if (rows.length < 2) {
    throw new Error("El archivo CSV está vacío o no tiene datos");
  }

  onStatus?.("Procesando transacciones...");
  onProgress?.(2, 3);

  const headerRowIdx = findHeaderRow(rows);
  if (headerRowIdx < 0) {
    throw new Error("No se encontró la fila de cabeceras del extracto imagin");
  }

  const headers = rows[headerRowIdx].map((h) => String(h ?? "").toLowerCase().trim());
  const conceptoIdx = headers.indexOf("concepto");
  const fechaIdx = headers.indexOf("fecha");
  const importeIdx = headers.indexOf("importe");
  const saldoIdx = headers.findIndex((h) => h.includes("saldo"));

  if (conceptoIdx < 0 || fechaIdx < 0 || importeIdx < 0) {
    throw new Error("No se pudieron identificar las columnas del CSV imagin");
  }

  const transactions: ImaginRawTransaction[] = [];

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;

    const concepto = String(row[conceptoIdx] ?? "").trim();
    const fechaStr = String(row[fechaIdx] ?? "").trim();
    const importeStr = String(row[importeIdx] ?? "");
    const saldoStr = saldoIdx >= 0 && row[saldoIdx] != null ? String(row[saldoIdx]) : "";

    const dateStr = parseImaginDate(fechaStr);
    if (!dateStr) continue;

    const importe = parseAmount(importeStr);
    if (importe === 0) continue;

    const saldo = parseAmount(saldoStr);

    transactions.push({
      concepto,
      fecha: dateStr,
      importe,
      saldo,
    });
  }

  onProgress?.(3, 3);
  onStatus?.(`Encontradas ${transactions.length} transacciones`);

  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
  );

  // La primera fila del CSV es la transacción más reciente; su "Saldo disponible" es el balance actual
  const finalBalance =
    transactions.length > 0 ? transactions[0].saldo : undefined;

  return {
    transactions: sortedTransactions,
    finalBalance,
  };
}

export async function normalizeImaginTransactions(
  transactions: ImaginRawTransaction[],
  accountId: string
): Promise<ImportedTransaction[]> {
  const result: ImportedTransaction[] = [];

  for (const tx of transactions) {
    const amount = Math.abs(tx.importe);
    if (amount === 0) continue;

    const isIncome = tx.importe > 0;
    const description = normalizeDescription(tx.concepto);

    const hash = await generateTransactionHash(
      accountId,
      tx.fecha,
      amount,
      description
    );

    result.push({
      date: tx.fecha,
      amount,
      type: isIncome ? "income" : "expense",
      description,
      external_hash: hash,
    });
  }

  return result;
}
