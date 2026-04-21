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
