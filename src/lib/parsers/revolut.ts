import * as XLSX from "xlsx";
import type { ImportedTransaction } from "./types";
import {
	assignOccurrenceIndices,
	buildImportSourceFingerprint,
} from "./importKeys";
import { generateTransactionHash } from "./utils";
import {
	parseRevolutFechaInicioToIsoUtc,
	revolutFechaInicioToMs,
} from "@/lib/revolutDate";

interface RevolutRawTransaction {
  tipo: string;
  producto: string;
  fechaInicio: string;
  fechaFin: string;
  descripcion: string;
  importe: number;
  comision: number;
  divisa: string;
  estado: string;
  saldo: number | null;
}

interface ParseRevolutOptions {
  onProgress?: (current: number, total: number) => void;
  onStatus?: (status: string) => void;
}

interface ParsedRevolutResult {
  transactions: RevolutRawTransaction[];
  finalBalance?: number;
  actualTransactions: RevolutRawTransaction[];
  depositTransactions: RevolutRawTransaction[];
  actualBalance?: number;
  depositBalance?: number;
}

const COLUMN_MAPPINGS: Record<string, keyof RevolutRawTransaction> = {
  "tipo": "tipo",
  "type": "tipo",
  "producto": "producto",
  "product": "producto",
  "deposito": "producto",
  "fecha de inicio": "fechaInicio",
  "started date": "fechaInicio",
  "fecha de finalizacion": "fechaFin",
  "completed date": "fechaFin",
  "descripcion": "descripcion",
  "description": "descripcion",
  "importe": "importe",
  "amount": "importe",
  "comision": "comision",
  "fee": "comision",
  "divisa": "divisa",
  "currency": "divisa",
  "state": "estado",
  "estado": "estado",
  "saldo": "saldo",
  "balance": "saldo",
};

function parseCSV(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  return lines.map(line => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
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

function fixCorruptedEncoding(text: string): string {
  if (!text) return "";
  
  try {
    const hasCorruptedChars = /[\xC2-\xDF][\x80-\xBF]|[\xE0-\xEF][\x80-\xBF]{2}|Ã[³©¡­º±¼"]|Â/.test(text);
    
    if (hasCorruptedChars) {
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) {
        bytes[i] = text.charCodeAt(i) & 0xFF;
      }
      const decoded = new TextDecoder("utf-8").decode(bytes);
      if (!decoded.includes("�")) {
        return decoded.replace(/\s+/g, " ").trim();
      }
    }
  } catch {
    // Fall through to original text
  }
  
  return text.replace(/\s+/g, " ").trim();
}

function normalizeHeaderText(header: string): string {
  let text = fixCorruptedEncoding(header).toLowerCase();
  
  text = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  
  return text;
}

function mapHeaders(headers: string[]): Record<number, keyof RevolutRawTransaction> {
  const mapping: Record<number, keyof RevolutRawTransaction> = {};
  
  headers.forEach((header, index) => {
    const normalized = normalizeHeaderText(header);
    const mapped = COLUMN_MAPPINGS[normalized];
    if (mapped) {
      mapping[index] = mapped;
    }
  });
  
  return mapping;
}

function excelDateToJSDate(excelDate: number): Date {
  const excelEpoch = new Date(1899, 11, 30);
  return new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000);
}

function parseExcelDate(value: string): string {
  const num = parseFloat(value);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    const date = excelDateToJSDate(num);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
  return value;
}

function parseRow(row: string[], headerMapping: Record<number, keyof RevolutRawTransaction>, isExcel: boolean = false): RevolutRawTransaction | null {
  const tx: Partial<RevolutRawTransaction> = {};
  
  for (const [indexStr, field] of Object.entries(headerMapping)) {
    const index = parseInt(indexStr, 10);
    let value = row[index];
    
    if (value === undefined) continue;
    
    if (typeof value === "string") {
      value = fixCorruptedEncoding(value);
    }
    
    if (field === "saldo") {
      const normalized = value.replace(",", ".").trim();
      if (normalized === "") {
        tx.saldo = null;
      } else {
        const num = parseFloat(normalized);
        tx.saldo = isNaN(num) ? null : num;
      }
    } else if (field === "importe" || field === "comision") {
      const num = parseFloat(value.replace(",", "."));
      tx[field] = isNaN(num) ? 0 : num;
    } else if ((field === "fechaInicio" || field === "fechaFin") && isExcel) {
      tx[field] = parseExcelDate(value) as never;
    } else {
      tx[field] = value as never;
    }
  }
  
  if (tx.comision === undefined) tx.comision = 0;
  if (tx.saldo === undefined) tx.saldo = null;
  if (tx.estado === undefined) tx.estado = "";
  
  if (!tx.fechaInicio || tx.importe === undefined) {
    return null;
  }
  
  return tx as RevolutRawTransaction;
}

function getBalanceByProduct(transactions: RevolutRawTransaction[], producto: string): number | undefined {
  const filtered = transactions.filter(tx => 
    tx.producto?.toLowerCase() === producto.toLowerCase()
  );
  
  if (filtered.length === 0) {
    return undefined;
  }

  const sortedByDateAsc = [...filtered].sort((a, b) => 
    revolutFechaInicioToMs(a.fechaInicio) - revolutFechaInicioToMs(b.fechaInicio)
  );

  let runningBalance: number | undefined;

  for (const tx of sortedByDateAsc) {
    if (tx.saldo !== null && Number.isFinite(tx.saldo)) {
      runningBalance = tx.saldo;
      continue;
    }

    // Si Revolut no informa saldo (p.ej. operación pendiente),
    // continuamos desde el último saldo conocido aplicando el neto.
    if (runningBalance !== undefined) {
      runningBalance += revolutNetAmount(tx);
    }
  }

  return runningBalance;
}

function separateTransactionsByProduct(transactions: RevolutRawTransaction[]): {
  actualTransactions: RevolutRawTransaction[];
  depositTransactions: RevolutRawTransaction[];
} {
  const actualTransactions: RevolutRawTransaction[] = [];
  const depositTransactions: RevolutRawTransaction[] = [];
  
  for (const tx of transactions) {
    const producto = tx.producto?.toLowerCase() || "";
    if (producto === "actual") {
      actualTransactions.push(tx);
    } else if (producto === "depósito" || producto === "deposito") {
      depositTransactions.push(tx);
    }
  }
  
  return { actualTransactions, depositTransactions };
}

export async function parseRevolutCSV(
  file: File,
  options?: ParseRevolutOptions
): Promise<ParsedRevolutResult> {
  const { onProgress, onStatus } = options || {};
  
  onStatus?.("Leyendo archivo CSV...");
  onProgress?.(1, 3);
  
  const content = await file.text();
  const rows = parseCSV(content);
  
  if (rows.length < 2) {
    throw new Error("El archivo CSV está vacío o no tiene datos");
  }
  
  onStatus?.("Procesando transacciones...");
  onProgress?.(2, 3);
  
  const headers = rows[0];
  const headerMapping = mapHeaders(headers);
  
  if (Object.keys(headerMapping).length < 3) {
    throw new Error("No se pudieron identificar las columnas del CSV");
  }
  
  const transactions: RevolutRawTransaction[] = [];
  
  for (let i = 1; i < rows.length; i++) {
    const tx = parseRow(rows[i], headerMapping);
    if (tx) {
      transactions.push(tx);
    }
  }
  
  onProgress?.(3, 3);
  onStatus?.(`Encontradas ${transactions.length} transacciones`);
  
  const sortByDate = (txs: RevolutRawTransaction[]) => 
    [...txs].sort((a, b) => 
      revolutFechaInicioToMs(a.fechaInicio) - revolutFechaInicioToMs(b.fechaInicio)
    );

  const sortedTransactions = sortByDate(transactions);
  const { actualTransactions, depositTransactions } = separateTransactionsByProduct(sortedTransactions);
  const actualBalance = getBalanceByProduct(sortedTransactions, "actual");
  const depositBalance = getBalanceByProduct(sortedTransactions, "depósito") ?? getBalanceByProduct(sortedTransactions, "deposito");
  
  return { 
    transactions: sortedTransactions, 
    finalBalance: actualBalance,
    actualTransactions: sortByDate(actualTransactions),
    depositTransactions: sortByDate(depositTransactions),
    actualBalance,
    depositBalance,
  };
}

export async function parseRevolutExcel(
  file: File,
  options?: ParseRevolutOptions
): Promise<ParsedRevolutResult> {
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
  
  const headers = jsonData[0].map(h => String(h || ""));
  const headerMapping = mapHeaders(headers);
  
  if (Object.keys(headerMapping).length < 3) {
    throw new Error("No se pudieron identificar las columnas del Excel");
  }
  
  const transactions: RevolutRawTransaction[] = [];
  
  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i].map(cell => String(cell ?? ""));
    const tx = parseRow(row, headerMapping, true);
    if (tx) {
      transactions.push(tx);
    }
  }
  
  onProgress?.(3, 3);
  onStatus?.(`Encontradas ${transactions.length} transacciones`);
  
  const sortByDate = (txs: RevolutRawTransaction[]) => 
    [...txs].sort((a, b) => 
      revolutFechaInicioToMs(a.fechaInicio) - revolutFechaInicioToMs(b.fechaInicio)
    );

  const sortedTransactions = sortByDate(transactions);
  const { actualTransactions, depositTransactions } = separateTransactionsByProduct(sortedTransactions);
  const actualBalance = getBalanceByProduct(sortedTransactions, "actual");
  const depositBalance = getBalanceByProduct(sortedTransactions, "depósito") ?? getBalanceByProduct(sortedTransactions, "deposito");
  
  return { 
    transactions: sortedTransactions, 
    finalBalance: actualBalance,
    actualTransactions: sortByDate(actualTransactions),
    depositTransactions: sortByDate(depositTransactions),
    actualBalance,
    depositBalance,
  };
}

function revolutNetAmount(tx: RevolutRawTransaction): number {
  return tx.importe - (tx.comision ?? 0);
}

/** Huella estable por fila del extracto (sin account id). Importe neto; sin columna State. */
export function buildRevolutStableRowFingerprint(tx: RevolutRawTransaction): string {
	const norm = (s: string) =>
		(s || "")
			.trim()
			.replace(/\s+/g, " ")
			.toLowerCase();
	const net = revolutNetAmount(tx);
	const parts = [
		"revolut",
		norm(tx.tipo),
		norm(tx.producto),
		norm(tx.fechaInicio),
		norm(tx.fechaFin),
		norm(tx.descripcion),
		net.toFixed(2),
		norm(tx.divisa),
		tx.saldo === null ? "" : tx.saldo.toFixed(2),
	];
	return parts.join("|");
}

export async function normalizeRevolutTransactions(
  transactions: RevolutRawTransaction[],
  accountId: string
): Promise<ImportedTransaction[]> {
  const prepared: Array<{
    dateStr: string;
    amount: number;
    isIncome: boolean;
    description: string;
    hash: string;
    baseFp: string;
    statement_balance?: number;
  }> = [];

  for (const tx of transactions) {
    const dateStr = parseRevolutFechaInicioToIsoUtc(tx.fechaInicio);
    if (!dateStr) continue;

    const net = revolutNetAmount(tx);
    if (net === 0) continue;

    const amount = Math.abs(net);
    const isIncome = net > 0;
    const description = fixCorruptedEncoding(tx.descripcion || "").trim();

    const hash = await generateTransactionHash(
      accountId,
      dateStr,
      amount,
      description
    );

    prepared.push({
      dateStr,
      amount,
      isIncome,
      description,
      hash,
      baseFp: buildRevolutStableRowFingerprint(tx),
      statement_balance: tx.saldo ?? undefined,
    });
  }

  const baseFingerprints = prepared.map((p) => p.baseFp);
  const occurrences = assignOccurrenceIndices(baseFingerprints);

  return prepared.map((p, i) => ({
    date: p.dateStr,
    amount: p.amount,
    type: p.isIncome ? "income" : "expense",
    description: p.description,
    external_hash: p.hash,
    import_source_fingerprint: buildImportSourceFingerprint(
      p.baseFp,
      occurrences[i]!
    ),
    statement_balance: p.statement_balance,
  }));
}
