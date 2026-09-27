import type { SupabaseClient } from "@supabase/supabase-js";
import type { PossibleDuplicate } from "@/lib/parsers/types";
import {
	buildDuplicateConflictKey,
	buildDuplicateConflictKeyLegacy,
} from "@/lib/parsers/importKeys";
import {
	amountsEqualExactCents,
	calendarDateKeyForDuplicate,
} from "@/lib/duplicateImport";

/** Margen horario para considerar la misma fila de extracto reexportada con otra zona horaria. */
const SHIFTED_REIMPORT_WINDOW_MS = 3 * 60 * 60 * 1000;
const QUERY_BATCH_SIZE = 80;
const QUERY_PAGE_SIZE = 1000;

export interface ReimportComparable {
	date: string;
	amount: number | string;
	type: string;
	description: string | null;
	statement_balance?: number | string | null;
}

function toCents(value: number | string): number {
	return Math.round(Number(value) * 100);
}

function normalizeDescriptionForCompare(value: string | null): string {
	return (value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * True si `incoming` es la misma fila bancaria que `existing` aunque su huella difiera
 * (el banco reexporta la hora desplazada o la descripción en otro idioma).
 * Con saldo de extracto en ambas, el saldo manda; si no, se exige misma descripción.
 */
export function isSameStatementRow(
	incoming: ReimportComparable,
	existing: ReimportComparable
): boolean {
	if ((incoming.type || "").toLowerCase() !== (existing.type || "").toLowerCase()) return false;
	if (toCents(incoming.amount) !== toCents(existing.amount)) return false;

	const incomingMs = new Date(incoming.date).getTime();
	const existingMs = new Date(existing.date).getTime();
	if (!Number.isFinite(incomingMs) || !Number.isFinite(existingMs)) return false;
	if (Math.abs(incomingMs - existingMs) > SHIFTED_REIMPORT_WINDOW_MS) return false;

	const incomingBalance = incoming.statement_balance;
	const existingBalance = existing.statement_balance;
	const hasBothBalances =
		incomingBalance !== undefined && incomingBalance !== null &&
		existingBalance !== undefined && existingBalance !== null;
	if (hasBothBalances) {
		return toCents(incomingBalance) === toCents(existingBalance);
	}

	return (
		normalizeDescriptionForCompare(incoming.description) ===
		normalizeDescriptionForCompare(existing.description)
	);
}

/**
 * Descarta filas cuyo import_line_id es nuevo pero que ya se importaron antes con
 * datos ligeramente distintos (ver isSameStatementRow). Cada fila existente
 * absorbe como mucho una entrante.
 */
export async function filterAlreadyImportedStatementRows<
	T extends { tx: ReimportComparable }
>(args: {
	supabase: SupabaseClient;
	accountId: string;
	rows: T[];
}): Promise<T[]> {
	const { supabase, accountId, rows } = args;
	if (rows.length === 0) return rows;

	const timestamps = rows
		.map((r) => new Date(r.tx.date).getTime())
		.filter((ms) => Number.isFinite(ms));
	if (timestamps.length === 0) return rows;

	const fromIso = new Date(Math.min(...timestamps) - SHIFTED_REIMPORT_WINDOW_MS).toISOString();
	const toIso = new Date(Math.max(...timestamps) + SHIFTED_REIMPORT_WINDOW_MS).toISOString();
	const distinctAmounts = [...new Set(rows.map((r) => Number(r.tx.amount)))];

	const existingRows: Array<ReimportComparable & { id: string }> = [];
	for (let i = 0; i < distinctAmounts.length; i += QUERY_BATCH_SIZE) {
		const amountBatch = distinctAmounts.slice(i, i + QUERY_BATCH_SIZE);
		for (let from = 0; ; from += QUERY_PAGE_SIZE) {
			const { data, error } = await supabase
				.from("transactions")
				.select("id, date, amount, type, description, statement_balance")
				.eq("account_id", accountId)
				// Filas importadas; las editadas pierden import_line_id pero conservan el saldo de extracto.
				.or("import_line_id.not.is.null,statement_balance.not.is.null")
				.in("amount", amountBatch)
				.gte("date", fromIso)
				.lte("date", toIso)
				.order("id")
				.range(from, from + QUERY_PAGE_SIZE - 1);
			if (error || !data) break;
			existingRows.push(...data);
			if (data.length < QUERY_PAGE_SIZE) break;
		}
	}
	if (existingRows.length === 0) return rows;

	const consumedExistingIds = new Set<string>();
	return rows.filter((row) => {
		const match = existingRows.find(
			(existing) =>
				!consumedExistingIds.has(existing.id) && isSameStatementRow(row.tx, existing)
		);
		if (!match) return true;
		consumedExistingIds.add(match.id);
		return false;
	});
}

/**
 * Tras insertar líneas de extracto, detecta cruces con transacciones manuales
 * (mismo día calendario, mismo importe al céntimo).
 */
export async function collectPossibleDuplicatesManualVsImport(args: {
	supabase: SupabaseClient;
	userId: string;
	accountId: string;
	insertedRows: Array<{
		id: string;
		import_line_id: string | null;
		date: string;
		amount: number | string;
		type: string;
		description: string | null;
		external_hash: string | null;
	}>;
	decisionMap: Map<string, string>;
}): Promise<PossibleDuplicate[]> {
	const { supabase, userId, accountId, insertedRows, decisionMap } = args;
	const possibleDuplicates: PossibleDuplicate[] = [];
	const seenConflictKeys = new Set<string>();

	for (const inserted of insertedRows) {
		if (!inserted.import_line_id) continue;

		const { data: manualSameAmount } = await supabase
			.from("transactions")
			.select("id, date, amount, type, description, import_line_id")
			.eq("account_id", accountId)
			.eq("user_id", userId)
			.is("import_line_id", null)
			.eq("amount", inserted.amount)
			.eq("type", inserted.type);

		const candidates = (manualSameAmount || []).filter((row) =>
			amountsEqualExactCents(Number(row.amount), Number(inserted.amount))
		);

		const insertedDay = calendarDateKeyForDuplicate(String(inserted.date));
		for (const existing of candidates) {
			if (
				calendarDateKeyForDuplicate(String(existing.date)) !== insertedDay
			) {
				continue;
			}

			const conflict_key = await buildDuplicateConflictKey(
				accountId,
				String(inserted.date),
				Number(inserted.amount),
				String(inserted.type)
			);
			const legacy_conflict_key = await buildDuplicateConflictKeyLegacy(
				accountId,
				String(inserted.date),
				Number(inserted.amount)
			);
			if (
				decisionMap.has(conflict_key) ||
				decisionMap.has(legacy_conflict_key) ||
				seenConflictKeys.has(conflict_key)
			) {
				continue;
			}
			seenConflictKeys.add(conflict_key);

			possibleDuplicates.push({
				conflict_key,
				incoming: {
					id: inserted.id,
					date: inserted.date,
					amount: Number(inserted.amount),
					description: inserted.description || "",
					external_hash: inserted.external_hash || "",
				},
				existing: {
					id: existing.id,
					description: existing.description || "",
					date: existing.date as string,
					amount: Number(existing.amount),
				},
			});
		}
	}

	return possibleDuplicates;
}
