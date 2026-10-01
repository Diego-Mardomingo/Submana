import type { SupabaseClient } from "@supabase/supabase-js";
import type {
	ImportTransactionsResponse,
	ImportedTransaction,
	PossibleDuplicate,
} from "@/lib/parsers/types";
import { generateTransactionHash } from "@/lib/parsers/utils";
import {
	buildDuplicateConflictKey,
	buildDuplicateConflictKeyLegacy,
	buildImportLineId,
} from "@/lib/parsers/importKeys";
import {
	collectPossibleDuplicatesManualVsImport,
	filterAlreadyImportedStatementRows,
} from "@/lib/importDuplicateDetection";
import { tagInternalTransfersAfterImport } from "@/lib/importTransferTagging";
import {
	amountsEqualExactCents,
	calendarDateKeyForDuplicate,
} from "@/lib/duplicateImport";

const BATCH_SIZE = 80;

type CandidateRow = { tx: ImportedTransaction; import_line_id: string };

export class ImportError extends Error {}

async function loadDecisionMap(
	supabase: SupabaseClient,
	userId: string,
	accountId: string
): Promise<Map<string, string>> {
	const { data } = await supabase
		.from("import_duplicate_decisions")
		.select("conflict_key, resolution")
		.eq("user_id", userId)
		.eq("account_id", accountId);
	const map = new Map<string, string>();
	for (const row of (data ?? []) as { conflict_key: string; resolution: string }[]) {
		map.set(row.conflict_key, row.resolution);
	}
	return map;
}

async function fetchExistingLineIds(
	supabase: SupabaseClient,
	accountId: string,
	lineIds: string[]
): Promise<Set<string>> {
	const existing = new Set<string>();
	for (let i = 0; i < lineIds.length; i += BATCH_SIZE) {
		const { data } = await supabase
			.from("transactions")
			.select("import_line_id")
			.eq("account_id", accountId)
			.in("import_line_id", lineIds.slice(i, i + BATCH_SIZE));
		data?.forEach((t) => t.import_line_id && existing.add(t.import_line_id));
	}
	return existing;
}

/** Categoría usada más recientemente para cada descripción (autocategorización). */
async function buildCategoryMap(
	supabase: SupabaseClient,
	userId: string,
	descriptions: string[]
): Promise<Record<string, { category_id: string | null; subcategory_id: string | null }>> {
	const map: Record<string, { category_id: string | null; subcategory_id: string | null }> = {};
	for (let i = 0; i < descriptions.length; i += BATCH_SIZE) {
		const { data } = await supabase
			.from("transactions")
			.select("description, category_id, subcategory_id, date")
			.eq("user_id", userId)
			.in("description", descriptions.slice(i, i + BATCH_SIZE))
			.not("category_id", "is", null)
			.order("date", { ascending: false });
		for (const tx of data ?? []) {
			if (tx.description && !map[tx.description]) {
				map[tx.description] = { category_id: tx.category_id, subcategory_id: tx.subcategory_id };
			}
		}
	}
	return map;
}

/**
 * Aplica decisiones guardadas: keep_existing descarta la fila importada; keep_import
 * borra (ajustando saldo de forma atómica) las manuales del mismo día e importe.
 */
async function applyDuplicateDecisions(
	supabase: SupabaseClient,
	userId: string,
	accountId: string,
	rows: CandidateRow[],
	decisionMap: Map<string, string>
): Promise<CandidateRow[]> {
	const result: CandidateRow[] = [];
	for (const row of rows) {
		const { tx } = row;
		const conflictKey = await buildDuplicateConflictKey(accountId, tx.date, tx.amount, tx.type);
		const legacyConflictKey = await buildDuplicateConflictKeyLegacy(accountId, tx.date, tx.amount);
		const resolution = decisionMap.get(conflictKey) ?? decisionMap.get(legacyConflictKey);

		if (resolution === "keep_existing") continue;

		if (resolution === "keep_import") {
			const { data: clash } = await supabase
				.from("transactions")
				.select("id, amount, date, type")
				.eq("account_id", accountId)
				.eq("user_id", userId)
				.is("import_line_id", null)
				.eq("amount", tx.amount)
				.eq("type", tx.type);
			const txDay = calendarDateKeyForDuplicate(tx.date);
			for (const c of clash ?? []) {
				if (
					amountsEqualExactCents(Number(c.amount), tx.amount) &&
					calendarDateKeyForDuplicate(String(c.date)) === txDay
				) {
					await supabase.rpc("delete_transaction_with_balance", {
						p_id: c.id,
						p_user_id: userId,
						p_adjust_balance: true,
					});
				}
			}
		}

		result.push(row);
	}
	return result;
}

/**
 * Importa líneas de extracto en una cuenta: deduplica (import_line_id, reexportaciones,
 * decisiones guardadas), inserta, etiqueta traspasos internos, detecta posibles duplicados
 * con transacciones manuales y actualiza el saldo (saldo del extracto si se conoce; si no,
 * delta atómico).
 */
export async function runStatementImport(args: {
	supabase: SupabaseClient;
	userId: string;
	accountId: string;
	currentBalance: number;
	transactions: ImportedTransaction[];
	finalBalance: number | null | undefined;
	/** Recalcula external_hash con el id real de la cuenta (el cliente no lo conocía). */
	recomputeExternalHash?: boolean;
	/** Asigna la categoría usada antes para la misma descripción. */
	autoCategorize?: boolean;
}): Promise<ImportTransactionsResponse> {
	const { supabase, userId, accountId, transactions, finalBalance } = args;

	const decisionMap = await loadDecisionMap(supabase, userId, accountId);

	const enriched = await Promise.all(
		transactions.map(async (tx): Promise<CandidateRow | null> => {
			if (!tx.import_source_fingerprint) return null;
			const external_hash = args.recomputeExternalHash
				? await generateTransactionHash(accountId, tx.date, tx.amount, tx.description)
				: tx.external_hash;
			const import_line_id = await buildImportLineId(accountId, tx.import_source_fingerprint);
			return { tx: { ...tx, external_hash }, import_line_id };
		})
	);

	// Intra-batch dedupe by import_line_id
	const seenLineIds = new Set<string>();
	const batchDeduped = enriched.filter((row): row is CandidateRow => {
		if (!row || seenLineIds.has(row.import_line_id)) return false;
		seenLineIds.add(row.import_line_id);
		return true;
	});

	const existingLineIds = await fetchExistingLineIds(
		supabase,
		accountId,
		batchDeduped.map((r) => r.import_line_id)
	);

	const notYetImported = await filterAlreadyImportedStatementRows({
		supabase,
		accountId,
		rows: batchDeduped.filter((r) => !existingLineIds.has(r.import_line_id)),
	});

	const candidateRows = await applyDuplicateDecisions(
		supabase,
		userId,
		accountId,
		notYetImported,
		decisionMap
	);

	let imported = 0;
	let balanceChange = 0;
	let internalTransfersTagged = 0;
	let possibleDuplicates: PossibleDuplicate[] = [];

	if (candidateRows.length > 0) {
		const categoryMap = args.autoCategorize
			? await buildCategoryMap(supabase, userId, [
					...new Set(candidateRows.map((r) => r.tx.description).filter(Boolean)),
				])
			: {};

		const toInsert = candidateRows.map(({ tx, import_line_id }) => {
			const categories = tx.description ? categoryMap[tx.description] : undefined;
			return {
				user_id: userId,
				account_id: accountId,
				amount: tx.amount,
				type: tx.type,
				date: tx.date,
				description: tx.description || null,
				external_hash: tx.external_hash,
				import_line_id,
				category_id: categories?.category_id || null,
				subcategory_id: categories?.subcategory_id || null,
				statement_balance: tx.statement_balance ?? null,
			};
		});

		const { data: insertedData, error: insertError } = await supabase
			.from("transactions")
			.insert(toInsert)
			.select("id, import_line_id, date, amount, type, description, external_hash");

		if (insertError) {
			throw new ImportError(insertError.message);
		}

		const inserted = insertedData ?? [];
		imported = inserted.length;

		internalTransfersTagged = await tagInternalTransfersAfterImport({
			supabase,
			userId,
			insertedIds: inserted.map((t) => t.id),
		});

		for (const { tx } of candidateRows) {
			balanceChange += tx.type === "income" ? tx.amount : -tx.amount;
		}

		possibleDuplicates = await collectPossibleDuplicatesManualVsImport({
			supabase,
			userId,
			accountId,
			insertedRows: inserted,
			decisionMap,
		});
	}

	let newBalance = args.currentBalance;
	if (finalBalance !== undefined && finalBalance !== null) {
		// El saldo del extracto es la fuente de verdad.
		newBalance = finalBalance;
		await supabase
			.from("accounts")
			.update({ balance: finalBalance })
			.eq("id", accountId)
			.eq("user_id", userId);
	} else if (balanceChange !== 0) {
		const { data } = await supabase.rpc("adjust_account_balance", {
			p_account_id: accountId,
			p_user_id: userId,
			p_delta: balanceChange,
		});
		newBalance = data != null ? Number(data) : args.currentBalance + balanceChange;
	}

	return {
		imported,
		skipped: transactions.length - imported,
		total: transactions.length,
		new_balance: newBalance,
		internal_transfers_tagged: internalTransfersTagged,
		possibleDuplicates: possibleDuplicates.length > 0 ? possibleDuplicates : undefined,
	};
}
