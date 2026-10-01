import { parseRevolutFechaInicioToIsoUtc, revolutFechaInicioToMs } from "@/lib/revolutDate";
import type { ImportedTransaction } from "./types";
import { parseCSV } from "./csv";
import { fingerprintText, readFirstSheet, toImportedTransactions, type ParseCallbacks } from "./utils";

interface RevolutRow {
  tipo: string;
  producto: string;
  fechaInicio: string;
  descripcion: string;
  importe: number;
  comision: number;
  divisa: string;
  saldo: number | null;
}

/** Normalised (accent-free, lowercase) header → field, Spanish and English exports. */
const COLUMNS: Record<string, keyof RevolutRow> = {
  tipo: "tipo", type: "tipo",
  producto: "producto", product: "producto", deposito: "producto",
  "fecha de inicio": "fechaInicio", "started date": "fechaInicio",
  descripcion: "descripcion", description: "descripcion",
  importe: "importe", amount: "importe",
  comision: "comision", fee: "comision",
  divisa: "divisa", currency: "divisa",
  saldo: "saldo", balance: "saldo",
};

/** Repairs UTF-8 text that was decoded as Latin-1 ("DescripciÃ³n") and collapses whitespace. */
function fixEncoding(text: string): string {
  if (!text) return "";
  if (/[\xC2-\xDF][\x80-\xBF]|[\xE0-\xEF][\x80-\xBF]{2}|Ã[³©¡­º±¼"]|Â/.test(text)) {
    try {
      const decoded = new TextDecoder("utf-8").decode(Uint8Array.from({ length: text.length }, (_, i) => text.charCodeAt(i) & 0xff));
      if (!decoded.includes("�")) text = decoded;
    } catch {
      // Keep the original text.
    }
  }
  return text.replace(/\s+/g, " ").trim();
}

const headerKey = (header: string) =>
  fixEncoding(header).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();

/** Days between the Excel epoch (1899-12-30) and the Unix epoch. */
const EXCEL_UNIX_EPOCH_OFFSET_DAYS = 25569;

/**
 * Excel serial date → "YYYY-MM-DD HH:mm:ss" wall-clock time, other values unchanged. The serial has
 * no zone, so it is converted in UTC: the local zone's 1899 LMT offset plus DST shifted it by
 * 1h14m–2h14m and moved late-night transactions to the next day.
 */
export function parseExcelDate(value: string): string {
  const serial = parseFloat(value);
  if (isNaN(serial) || serial <= 40000 || serial >= 60000) return value;
  const d = new Date(Math.round((serial - EXCEL_UNIX_EPOCH_OFFSET_DAYS) * 86400) * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function parseRow(cells: string[], mapping: [number, keyof RevolutRow][], isExcel: boolean): RevolutRow | null {
  const tx: Partial<RevolutRow> = { comision: 0, saldo: null };
  for (const [index, field] of mapping) {
    const raw = cells[index];
    if (raw === undefined) continue;
    const value = fixEncoding(raw);
    if (field === "saldo") {
      const num = parseFloat(value.replace(",", ".").trim());
      tx.saldo = value.trim() === "" || isNaN(num) ? null : num;
    } else if (field === "importe" || field === "comision") {
      const num = parseFloat(value.replace(",", "."));
      tx[field] = isNaN(num) ? 0 : num;
    } else {
      tx[field] = field === "fechaInicio" && isExcel ? parseExcelDate(value) : value;
    }
  }
  return tx.fechaInicio && tx.importe !== undefined ? (tx as RevolutRow) : null;
}

const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const net = (tx: RevolutRow) => tx.importe - (tx.comision ?? 0);
const hasBalance = (tx: RevolutRow) => tx.saldo !== null && Number.isFinite(tx.saldo) && tx.saldo !== 0;
const byStartDate = (txs: RevolutRow[]) => [...txs].sort((a, b) => revolutFechaInicioToMs(a.fechaInicio) - revolutFechaInicioToMs(b.fechaInicio));

/**
 * Stable per-row balance so pending rows (no balance) still get a deterministic fingerprint:
 * given balances are kept, gaps are filled forward from the last known one, rows before the
 * first known balance are filled backwards, and without any balance it accumulates from 0.
 */
function normalizedBalances(transactions: RevolutRow[]): Map<RevolutRow, number> {
  const balances = new Map<RevolutRow, number>();
  const sorted = byStartDate(transactions);
  let running: number | undefined;
  for (const tx of sorted) {
    if (hasBalance(tx)) {
      running = tx.saldo!;
      balances.set(tx, cents(running));
    } else if (running !== undefined) {
      running = cents(running + net(tx));
      balances.set(tx, running);
    }
  }

  const firstKnown = sorted.findIndex((tx) => balances.has(tx));
  if (firstKnown === -1) {
    running = 0;
    for (const tx of sorted) balances.set(tx, (running = cents(running + net(tx))));
  }
  // balance(i) = balance(i + 1) - net(i + 1)
  for (let i = firstKnown - 1; i >= 0; i--) balances.set(sorted[i], cents(balances.get(sorted[i + 1])! - net(sorted[i + 1])));
  return balances;
}

/** Final balance of a product: last given balance in statement order (the reliable order), else derived. */
function productBalance(transactions: RevolutRow[]): number | undefined {
  const withBalance = transactions.findLast(hasBalance);
  if (withBalance) return cents(withBalance.saldo!);
  const last = transactions.at(-1);
  return last && normalizedBalances(transactions).get(last);
}

/** Splits a Revolut statement into the current account ("Actual") and the savings pocket ("Depósito"). */
function splitStatement(cells: string[][], isExcel: boolean, onProgress?: ParseCallbacks["onProgress"], onStatus?: ParseCallbacks["onStatus"]) {
  const mapping = cells[0].flatMap((header, index) => (COLUMNS[headerKey(header)] ? [[index, COLUMNS[headerKey(header)]] as [number, keyof RevolutRow]] : []));
  if (mapping.length < 3) throw new Error(`No se pudieron identificar las columnas del ${isExcel ? "Excel" : "CSV"}`);

  const transactions = cells.slice(1).flatMap((row) => parseRow(row, mapping, isExcel) ?? []);
  onProgress?.(3, 3);
  onStatus?.(`Encontradas ${transactions.length} transacciones`);

  const product = (tx: RevolutRow) => tx.producto?.toLowerCase() ?? "";
  const actual = transactions.filter((tx) => product(tx) === "actual");
  const deposit = transactions.filter((tx) => product(tx) === "depósito" || product(tx) === "deposito");
  return {
    actualTransactions: byStartDate(actual),
    depositTransactions: byStartDate(deposit),
    actualBalance: productBalance(actual),
    depositBalance: productBalance(deposit),
  };
}

export async function parseRevolutCSV(file: File, { onProgress, onStatus }: ParseCallbacks = {}) {
  onStatus?.("Leyendo archivo CSV...");
  onProgress?.(1, 3);
  const rows = parseCSV(await file.text(), ",");
  if (rows.length < 2) throw new Error("El archivo CSV está vacío o no tiene datos");
  onStatus?.("Procesando transacciones...");
  onProgress?.(2, 3);
  return splitStatement(rows, false, onProgress, onStatus);
}

export async function parseRevolutExcel(file: File, { onProgress, onStatus }: ParseCallbacks = {}) {
  onStatus?.("Leyendo archivo Excel...");
  onProgress?.(1, 3);
  const rows = (await readFirstSheet(file)).map((row) => row.map((cell) => String(cell ?? "")));
  if (rows.length < 2) throw new Error("El archivo Excel está vacío o no tiene datos");
  onStatus?.("Procesando transacciones...");
  onProgress?.(2, 3);
  return splitStatement(rows, true, onProgress, onStatus);
}

/** Fingerprint: net amount and normalised balance, without the volatile State column. */
export function normalizeRevolutTransactions(transactions: RevolutRow[], accountId: string): Promise<ImportedTransaction[]> {
  const balances = normalizedBalances(transactions);
  return toImportedTransactions(
    accountId,
    transactions.flatMap((tx) => {
      const date = parseRevolutFechaInicioToIsoUtc(tx.fechaInicio);
      if (!date) return [];
      const balance = balances.get(tx);
      const parts = [tx.tipo, tx.producto, tx.fechaInicio, tx.descripcion].map(fingerprintText);
      return {
        date,
        signedAmount: net(tx),
        description: fixEncoding(tx.descripcion || ""),
        statement_balance: balance,
        fingerprint: ["revolut", ...parts, net(tx).toFixed(2), fingerprintText(tx.divisa), balance === undefined ? "" : balance.toFixed(2)].join("|"),
      };
    })
  );
}
