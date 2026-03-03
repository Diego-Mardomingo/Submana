import * as XLSX from "xlsx";
import type { ImportedTransaction } from "./types";
import { generateTransactionHash } from "./utils";

interface BBVARawTransaction {
  fechaValor: string;
  fecha: string;
  concepto: string;
  movimiento: string;
  importe: number;
  disponible: number;
}

interface ParseBBVAOptions {
  onProgress?: (current: number, total: number) => void;
  onStatus?: (status: string) => void;
}

export interface ParsedBBVAResult {
  transactions: BBVARawTransaction[];
  finalBalance?: number;
}

function findHeaderRow(jsonData: unknown[][]): number {
  for (let i = 0; i < Math.min(20, jsonData.length); i++) {
    const row = jsonData[i];
    if (!Array.isArray(row)) continue;
    const rowStr = row.map((c) => String(c ?? "").toLowerCase()).join(" ");
    if (rowStr.includes("fecha valor") || (rowStr.includes("fecha") && rowStr.includes("concepto") && rowStr.includes("importe"))) {
      return i;
    }
  }
  return -1;
}

function getColumnIndices(headers: string[]): { fechaValor: number; concepto: number; movimiento: number; importe: number; disponible: number } | null {
  if (!Array.isArray(headers)) return null;
  const lower = headers.map((h) => String(h ?? "").toLowerCase().trim());
  let fechaValor = -1;
  let concepto = -1;
  let movimiento = -1;
  let importe = -1;
  let disponible = -1;

  for (let i = 0; i < lower.length; i++) {
    const h = String(lower[i] ?? "");
    if (!h) continue;
    if (h.includes("fecha valor")) fechaValor = i;
    else if (h === "concepto") concepto = i;
    else if (h === "movimiento") movimiento = i;
    else if (h === "importe") importe = i;
    else if (h === "disponible") disponible = i;
  }

  if (concepto >= 0 && importe >= 0) {
    if (fechaValor < 0) {
      const fechaIdx = lower.findIndex((h) => h === "fecha");
      fechaValor = fechaIdx >= 0 ? fechaIdx : concepto - 2;
    }
    return { fechaValor, concepto, movimiento, importe, disponible };
  }
  return null;
}

function parseBBVADate(value: string): string | null {
  const str = String(value ?? "").trim();
  const match = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return null;
}

function parseRow(
  row: unknown[],
  indices: { fechaValor: number; concepto: number; movimiento: number; importe: number; disponible: number }
): BBVARawTransaction | null {
  const get = (i: number) => {
    const val = row[i];
    if (val == null) return "";
    return String(val).trim();
  };

  const fechaValor = get(indices.fechaValor);
  const concepto = get(indices.concepto);
  const movimiento = get(indices.movimiento);
  const importeVal = row[indices.importe];
  const disponibleVal = row[indices.disponible];

  const dateStr = parseBBVADate(fechaValor);
  if (!dateStr) return null;

  let amount = 0;
  if (typeof importeVal === "number" && !isNaN(importeVal)) {
    amount = importeVal;
  } else {
    const parsed = parseFloat(String(importeVal ?? "0").replace(",", "."));
    amount = isNaN(parsed) ? 0 : parsed;
  }

  let disponible = 0;
  if (typeof disponibleVal === "number" && !isNaN(disponibleVal)) {
    disponible = disponibleVal;
  } else if (indices.disponible >= 0) {
    const parsed = parseFloat(String(disponibleVal ?? "0").replace(",", "."));
    disponible = isNaN(parsed) ? 0 : parsed;
  }

  if (amount === 0) return null;

  return {
    fechaValor: dateStr,
    fecha: dateStr,
    concepto,
    movimiento,
    importe: amount,
    disponible,
  };
}

function capitalizeWords(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeBBVADescription(tx: BBVARawTransaction): string {
  const concepto = (tx.concepto || "").trim();
  const movimiento = (tx.movimiento || "").trim();

  if (concepto && movimiento && concepto !== movimiento) {
    return `${capitalizeWords(concepto)} - ${capitalizeWords(movimiento)}`;
  }
  if (movimiento) return capitalizeWords(movimiento);
  if (concepto) return capitalizeWords(concepto);
  return "Transacción";
}

export async function parseBBVAExcel(
  file: File,
  options?: ParseBBVAOptions
): Promise<ParsedBBVAResult> {
  const { onProgress, onStatus } = options || {};

  onStatus?.("Leyendo archivo Excel...");
  onProgress?.(1, 3);

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });

  if (jsonData.length < 2) {
    throw new Error("El archivo Excel está vacío o no tiene datos");
  }

  onStatus?.("Procesando transacciones...");
  onProgress?.(2, 3);

  const headerRowIdx = findHeaderRow(jsonData);
  if (headerRowIdx < 0) {
    throw new Error("No se encontró la fila de cabeceras del informe BBVA");
  }

  const headerRow = jsonData[headerRowIdx];
  const headers = Array.isArray(headerRow) ? headerRow.map((h) => String(h ?? "")) : [];
  const indices = getColumnIndices(headers);
  if (!indices) {
    throw new Error("No se pudieron identificar las columnas del Excel BBVA");
  }

  const transactions: BBVARawTransaction[] = [];
  for (let i = headerRowIdx + 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!Array.isArray(row)) continue;
    const tx = parseRow(row, indices);
    if (tx) transactions.push(tx);
  }

  onProgress?.(3, 3);
  onStatus?.(`Encontradas ${transactions.length} transacciones`);

  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(a.fechaValor).getTime() - new Date(b.fechaValor).getTime()
  );

  const finalBalance =
    sortedTransactions.length > 0
      ? sortedTransactions[sortedTransactions.length - 1].disponible
      : undefined;

  return {
    transactions: sortedTransactions,
    finalBalance,
  };
}

export async function normalizeBBVATransactions(
  transactions: BBVARawTransaction[],
  accountId: string
): Promise<ImportedTransaction[]> {
  const result: ImportedTransaction[] = [];

  for (const tx of transactions) {
    const amount = Math.abs(tx.importe);
    if (amount === 0) continue;

    const isIncome = tx.importe > 0;
    const description = normalizeBBVADescription(tx);

    const hash = await generateTransactionHash(
      accountId,
      tx.fechaValor,
      amount,
      description
    );

    result.push({
      date: tx.fechaValor,
      amount,
      type: isIncome ? "income" : "expense",
      description,
      external_hash: hash,
    });
  }

  return result;
}
