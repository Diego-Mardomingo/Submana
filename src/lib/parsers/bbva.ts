import * as XLSX from "xlsx";
import type { ImportedTransaction } from "./types";
import {
	assignOccurrenceIndices,
	buildImportSourceFingerprint,
} from "./importKeys";
import { generateTransactionHash, parseEuropeanNumber } from "./utils";

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

function getColumnIndices(headers: string[]): {
  fecha: number;
  concepto: number;
  movimiento: number;
  importe: number;
  disponible: number;
} | null {
  if (!Array.isArray(headers)) return null;
  const lower = headers.map((h) => String(h ?? "").toLowerCase().trim());
  let fecha = -1;
  let fechaValorFallback = -1;
  let concepto = -1;
  let movimiento = -1;
  let importe = -1;
  let disponible = -1;

  for (let i = 0; i < lower.length; i++) {
    const h = String(lower[i] ?? "");
    if (!h) continue;
    // "Fecha" exacta = fecha de la transacción (usar siempre para consistencia entre formatos)
    if (h === "fecha") fecha = i;
    // "Fecha valor" / "F.Valor" = fallback si no hay columna "Fecha"
    else if (h.includes("fecha valor") || h === "f.valor" || h === "f. valor")
      fechaValorFallback = i;
    else if (h === "concepto") concepto = i;
    else if (h === "movimiento") movimiento = i;
    else if (h === "importe") importe = i;
    else if (h === "disponible") disponible = i;
  }

  if (concepto >= 0 && importe >= 0) {
    if (fecha < 0) fecha = fechaValorFallback >= 0 ? fechaValorFallback : concepto - 2;
    return { fecha, concepto, movimiento, importe, disponible };
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

/**
 * Celdas numéricas llegan como number; las de texto con formato español ("1.234,56").
 * parseFloat("1.234,56".replace(",", ".")) daba 1.234.
 */
export function parseBBVANumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const str = String(value ?? "").trim();
  if (!str) return 0;
  if (str.includes(",")) return parseEuropeanNumber(str);
  const parsed = parseFloat(str.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Saldo tras el último movimiento del último día, sin depender del orden del fichero:
 * es el único cuyo "disponible" no es el saldo previo de otro movimiento de ese día.
 */
export function findFinalBalance(transactions: BBVARawTransaction[]): number | undefined {
  if (transactions.length === 0) return undefined;
  const lastDay = transactions.reduce((max, tx) => (tx.fecha > max ? tx.fecha : max), transactions[0].fecha);
  const sameDay = transactions.filter((tx) => tx.fecha === lastDay);
  const cents = (n: number) => Math.round(n * 100);
  const previousBalances = new Set(sameDay.map((tx) => cents(tx.disponible - tx.importe)));
  const last = sameDay.filter((tx) => !previousBalances.has(cents(tx.disponible)));
  // Si la cadena es ambigua, BBVA exporta primero el más reciente.
  return (last.length === 1 ? last[0] : sameDay[0]).disponible;
}

function parseRow(
  row: unknown[],
  indices: { fecha: number; concepto: number; movimiento: number; importe: number; disponible: number }
): BBVARawTransaction | null {
  const get = (i: number) => {
    const val = row[i];
    if (val == null) return "";
    return String(val).trim();
  };

  const fechaStr = get(indices.fecha);
  const concepto = get(indices.concepto);
  const movimiento = get(indices.movimiento);
  const importeVal = row[indices.importe];
  const disponibleVal = row[indices.disponible];

  const dateStr = parseBBVADate(fechaStr);
  if (!dateStr) return null;

  const amount = parseBBVANumber(importeVal);
  const disponible = indices.disponible >= 0 ? parseBBVANumber(disponibleVal) : 0;

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

  const finalBalance = findFinalBalance(transactions);

  return {
    transactions: sortedTransactions,
    finalBalance,
  };
}

function buildBBVAStableRowFingerprint(tx: BBVARawTransaction): string {
	const norm = (s: string) =>
		(s || "")
			.trim()
			.replace(/\s+/g, " ")
			.toLowerCase();
	const parts = [
		"bbva",
		tx.fecha,
		norm(tx.concepto),
		norm(tx.movimiento),
		tx.importe.toFixed(2),
		tx.disponible.toFixed(2),
	];
	return parts.join("|");
}

export async function normalizeBBVATransactions(
  transactions: BBVARawTransaction[],
  accountId: string
): Promise<ImportedTransaction[]> {
  const rows: Array<{
    date: string;
    amount: number;
    type: "income" | "expense";
    description: string;
    hash: string;
    baseFp: string;
  }> = [];

  for (const tx of transactions) {
    const amount = Math.abs(tx.importe);
    if (amount === 0) continue;

    const isIncome = tx.importe > 0;
    const description = normalizeBBVADescription(tx);

    const hash = await generateTransactionHash(
      accountId,
      tx.fecha,
      amount,
      description
    );

    rows.push({
      date: tx.fecha,
      amount,
      type: isIncome ? "income" : "expense",
      description,
      hash,
      baseFp: buildBBVAStableRowFingerprint(tx),
    });
  }

  const occ = assignOccurrenceIndices(rows.map((r) => r.baseFp));

  return rows.map((r, i) => ({
    date: r.date,
    amount: r.amount,
    type: r.type,
    description: r.description,
    external_hash: r.hash,
    import_source_fingerprint: buildImportSourceFingerprint(r.baseFp, occ[i]!),
  }));
}
