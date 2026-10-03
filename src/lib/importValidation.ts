import type { ImportedTransaction, ImportResolution } from "@/lib/parsers/types";

/** Límite por petición: un extracto anual grande cabe de sobra; evita payloads abusivos. */
export const MAX_IMPORT_ROWS = 5000;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_FINGERPRINT_LENGTH = 2000;
const SHA256_HEX = /^[0-9a-f]{64}$/;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Valida la lista de transacciones y el saldo final que envía el cliente al importar.
 * El parseo ocurre en el navegador, así que el servidor no puede confiar en su forma.
 * Devuelve un código de error o null.
 */
export function validateImportPayload(
  transactions: unknown,
  finalBalance: unknown
): string | null {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return "missing or empty transactions";
  }
  if (transactions.length > MAX_IMPORT_ROWS) {
    return "too_many_transactions";
  }
  if (finalBalance !== undefined && finalBalance !== null && !isFiniteNumber(finalBalance)) {
    return "invalid_final_balance";
  }

  for (const raw of transactions) {
    if (!raw || typeof raw !== "object") return "invalid_transaction";
    const tx = raw as Partial<ImportedTransaction>;
    if (tx.type !== "income" && tx.type !== "expense") return "invalid_transaction_type";
    if (!isFiniteNumber(tx.amount) || tx.amount <= 0) return "invalid_transaction_amount";
    if (typeof tx.date !== "string" || Number.isNaN(new Date(tx.date).getTime())) {
      return "invalid_transaction_date";
    }
    if (tx.description != null && (typeof tx.description !== "string" || tx.description.length > MAX_DESCRIPTION_LENGTH)) {
      return "invalid_transaction_description";
    }
    if (
      tx.import_source_fingerprint != null &&
      (typeof tx.import_source_fingerprint !== "string" ||
        tx.import_source_fingerprint.length > MAX_FINGERPRINT_LENGTH)
    ) {
      return "invalid_transaction_fingerprint";
    }
    if (tx.external_hash != null && (typeof tx.external_hash !== "string" || !SHA256_HEX.test(tx.external_hash))) {
      return "invalid_transaction_hash";
    }
    if (tx.statement_balance != null && !isFiniteNumber(tx.statement_balance)) {
      return "invalid_statement_balance";
    }
  }
  return null;
}

const RESOLUTION_ACTIONS = new Set(["merge", "insert", "skip"]);

/** Valida las resoluciones opcionales del usuario (merge / insert / skip por huella de fila). Devuelve un código de error o null. */
export function validateResolutions(resolutions: unknown): string | null {
  if (resolutions === undefined || resolutions === null) return null;
  if (!Array.isArray(resolutions) || resolutions.length > MAX_IMPORT_ROWS) return "invalid_resolutions";
  for (const raw of resolutions) {
    if (!raw || typeof raw !== "object") return "invalid_resolutions";
    const r = raw as Partial<ImportResolution>;
    if (typeof r.fingerprint !== "string" || !r.fingerprint || r.fingerprint.length > MAX_FINGERPRINT_LENGTH) return "invalid_resolutions";
    if (typeof r.action !== "string" || !RESOLUTION_ACTIONS.has(r.action)) return "invalid_resolutions";
    if (r.target_id != null && (typeof r.target_id !== "string" || r.target_id.length > 64)) return "invalid_resolutions";
  }
  return null;
}
