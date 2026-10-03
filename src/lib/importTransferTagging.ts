import type { SupabaseClient } from "@supabase/supabase-js";
import { detectTransferIds, type TransferDetectable } from "@/lib/transferDetection";

const TRANSFER_WINDOW_HOURS = 48;
const QUERY_BATCH_SIZE = 80;
const QUERY_PAGE_SIZE = 1000;

type UncategorizedTransaction = TransferDetectable & { date: string };

/** Categoría raíz con exclude_from_metrics; prioriza la por defecto sobre las del usuario. */
async function findExcludeFromMetricsCategoryId(
	supabase: SupabaseClient,
	userId: string
): Promise<string | null> {
	const { data } = await supabase
		.from("categories")
		.select("id, user_id")
		.eq("exclude_from_metrics", true)
		.is("parent_id", null)
		.or(`user_id.is.null,user_id.eq.${userId}`);
	if (!data || data.length === 0) return null;
	const defaultCategory = data.find((c) => c.user_id === null);
	return (defaultCategory ?? data[0]!).id;
}

async function fetchUncategorizedByIds(
	supabase: SupabaseClient,
	userId: string,
	ids: string[]
): Promise<UncategorizedTransaction[]> {
	const result: UncategorizedTransaction[] = [];
	for (let i = 0; i < ids.length; i += QUERY_BATCH_SIZE) {
		const { data } = await supabase
			.from("transactions")
			.select("id, amount, type, date, account_id, shared_expense_id")
			.eq("user_id", userId)
			.is("category_id", null)
			.is("subcategory_id", null)
			.in("id", ids.slice(i, i + QUERY_BATCH_SIZE));
		if (data) result.push(...data);
	}
	return result;
}

async function fetchUncategorizedCounterparts(
	supabase: SupabaseClient,
	userId: string,
	inserted: UncategorizedTransaction[]
): Promise<UncategorizedTransaction[]> {
	const windowMs = TRANSFER_WINDOW_HOURS * 60 * 60 * 1000;
	const timestamps = inserted
		.map((tx) => new Date(tx.date).getTime())
		.filter((ms) => Number.isFinite(ms));
	if (timestamps.length === 0) return [];

	const fromIso = new Date(Math.min(...timestamps) - windowMs).toISOString();
	const toIso = new Date(Math.max(...timestamps) + windowMs).toISOString();
	const distinctAmounts = [...new Set(inserted.map((tx) => Number(tx.amount)))];

	const result: UncategorizedTransaction[] = [];
	for (let i = 0; i < distinctAmounts.length; i += QUERY_BATCH_SIZE) {
		const amountBatch = distinctAmounts.slice(i, i + QUERY_BATCH_SIZE);
		for (let from = 0; ; from += QUERY_PAGE_SIZE) {
			const { data, error } = await supabase
				.from("transactions")
				.select("id, amount, type, date, account_id, shared_expense_id")
				.eq("user_id", userId)
				.is("category_id", null)
				.is("subcategory_id", null)
				.in("amount", amountBatch)
				.gte("date", fromIso)
				.lte("date", toIso)
				.order("id")
				.range(from, from + QUERY_PAGE_SIZE - 1);
			if (error || !data) break;
			result.push(...data);
			if (data.length < QUERY_PAGE_SIZE) break;
		}
	}
	return result;
}

/**
 * Las filas ligadas a un gasto compartido o sin cuenta (virtuales) nunca se emparejan como traspaso
 * (lo garantiza detectTransferIds).
 * Tras una importación, empareja traspasos entre cuentas del usuario (gasto e ingreso del
 * mismo importe en cuentas distintas y fechas cercanas) y les asigna la categoría
 * "Excluir de métricas". Solo toca transacciones sin categoría para respetar las del usuario.
 * Devuelve el número de transacciones etiquetadas.
 */
export async function tagInternalTransfersAfterImport(args: {
	supabase: SupabaseClient;
	userId: string;
	insertedIds: string[];
}): Promise<number> {
	const { supabase, userId, insertedIds } = args;
	if (insertedIds.length === 0) return 0;

	const excludeCategoryId = await findExcludeFromMetricsCategoryId(supabase, userId);
	if (!excludeCategoryId) return 0;

	const inserted = await fetchUncategorizedByIds(supabase, userId, insertedIds);
	if (inserted.length === 0) return 0;

	const counterparts = await fetchUncategorizedCounterparts(supabase, userId, inserted);
	const byId = new Map<string, UncategorizedTransaction>();
	for (const tx of [...inserted, ...counterparts]) byId.set(tx.id, tx);

	const transferIds = [...detectTransferIds([...byId.values()], TRANSFER_WINDOW_HOURS)];
	if (transferIds.length === 0) return 0;

	let tagged = 0;
	for (let i = 0; i < transferIds.length; i += QUERY_BATCH_SIZE) {
		const { data, error } = await supabase
			.from("transactions")
			.update({ category_id: excludeCategoryId, subcategory_id: null })
			.eq("user_id", userId)
			.is("category_id", null)
			.in("id", transferIds.slice(i, i + QUERY_BATCH_SIZE))
			.select("id");
		if (!error && data) tagged += data.length;
	}
	return tagged;
}
