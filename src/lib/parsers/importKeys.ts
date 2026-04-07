/**
 * Opaque import line identity and duplicate-resolution keys shared client/server.
 */

import { calendarDateKeyForDuplicate } from "@/lib/duplicateImport";

export async function sha256Hex(text: string): Promise<string> {
	const encoder = new TextEncoder();
	const dataBuffer = encoder.encode(text);
	const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Per-account unique id for a bank row: hash(accountId|importSourceFingerprint). */
export async function buildImportLineId(
	accountId: string,
	importSourceFingerprint: string
): Promise<string> {
	return sha256Hex(`${accountId}|${importSourceFingerprint}`);
}

/**
 * Stable key for “same conflict” across imports (used with import_duplicate_decisions).
 * Solo día calendario + importe exacto (céntimos); la descripción no forma parte de la clave.
 * Debe coincidir con la ruta duplicate-decisions y la UI.
 */
export async function buildDuplicateConflictKey(
	accountId: string,
	date: string,
	amount: number
): Promise<string> {
	const dayKey = calendarDateKeyForDuplicate(date);
	const cents = Math.round(Number(amount) * 100);
	return sha256Hex(`${accountId}|${dayKey}|${cents}`);
}

/** Ordinal for identical base fingerprints within one parse (0-based). */
export function assignOccurrenceIndices(fingerprints: string[]): number[] {
	const seen = new Map<string, number>();
	return fingerprints.map((fp) => {
		const n = seen.get(fp) ?? 0;
		seen.set(fp, n + 1);
		return n;
	});
}

export function buildImportSourceFingerprint(baseFingerprint: string, occurrenceIndex: number): string {
	return `${baseFingerprint}|occ:${occurrenceIndex}`;
}
