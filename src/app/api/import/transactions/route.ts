import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";
import type { ImportTransactionsRequest, ImportTransactionsResponse, PossibleDuplicate } from "@/lib/parsers/types";
import {
	buildDuplicateConflictKey,
	buildImportLineId,
} from "@/lib/parsers/importKeys";
import { collectPossibleDuplicatesManualVsImport } from "@/lib/importDuplicateDetection";
import {
	amountsEqualExactCents,
	calendarDateKeyForDuplicate,
} from "@/lib/duplicateImport";
import type { SupabaseClient } from "@supabase/supabase-js";

type DuplicateDecisionRow = { conflict_key: string; resolution: string };

async function deleteTransactionAndAdjustBalance(
	supabase: SupabaseClient,
	userId: string,
	transactionId: string
) {
	const { data: transaction } = await supabase
		.from("transactions")
		.select("*")
		.eq("id", transactionId)
		.eq("user_id", userId)
		.single();

	if (!transaction) return;

	const { error } = await supabase
		.from("transactions")
		.delete()
		.eq("id", transactionId)
		.eq("user_id", userId);

	if (error) return;

	if (transaction.account_id) {
		const { data: account } = await supabase
			.from("accounts")
			.select("balance")
			.eq("id", transaction.account_id)
			.single();
		if (account) {
			let newBalance = Number(account.balance);
			if (transaction.type === "income") {
				newBalance -= Number(transaction.amount);
			} else {
				newBalance += Number(transaction.amount);
			}
			await supabase
				.from("accounts")
				.update({ balance: newBalance })
				.eq("id", transaction.account_id);
		}
	}
}

export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return jsonError("Unauthorized", 401);
	}

	const body = await request.json() as ImportTransactionsRequest;
	const { account_id, transactions, final_balance } = body;

	if (!account_id) {
		return jsonError("missing account_id");
	}
	if (!transactions) {
		return jsonError("missing transactions");
	}
	if (!Array.isArray(transactions)) {
		return jsonError("transactions must be an array");
	}
	if (transactions.length === 0) {
		return jsonError("transactions array is empty");
	}

	const { data: account, error: accountError } = await supabase
		.from("accounts")
		.select("id, balance, bank_provider")
		.eq("id", account_id)
		.eq("user_id", user.id)
		.single();

	if (accountError || !account) {
		return jsonError("Account not found or access denied", 404);
	}

	const { data: decisionRows } = await supabase
		.from("import_duplicate_decisions")
		.select("conflict_key, resolution")
		.eq("user_id", user.id)
		.eq("account_id", account_id);

	const decisionMap = new Map<string, string>();
	for (const row of (decisionRows || []) as DuplicateDecisionRow[]) {
		decisionMap.set(row.conflict_key, row.resolution);
	}

	const withLineIds = await Promise.all(
		transactions.map(async (t) => {
			if (!t.import_source_fingerprint) {
				return null;
			}
			const import_line_id = await buildImportLineId(
				account_id,
				t.import_source_fingerprint
			);
			return { tx: t, import_line_id };
		})
	);

	const validRows = withLineIds.filter(
		(x): x is NonNullable<typeof x> => x !== null
	);

	// Intra-batch dedupe by import_line_id
	const seenLineIds = new Set<string>();
	const batchDeduped = validRows.filter((row) => {
		if (seenLineIds.has(row.import_line_id)) return false;
		seenLineIds.add(row.import_line_id);
		return true;
	});

	const lineIds = batchDeduped.map((r) => r.import_line_id);
	const BATCH_SIZE = 80;
	const existingLineIds = new Set<string>();
	for (let i = 0; i < lineIds.length; i += BATCH_SIZE) {
		const batch = lineIds.slice(i, i + BATCH_SIZE);
		const { data } = await supabase
			.from("transactions")
			.select("import_line_id")
			.eq("account_id", account_id)
			.in("import_line_id", batch);
		if (data) {
			data.forEach((t) => t.import_line_id && existingLineIds.add(t.import_line_id));
		}
	}

	let candidateRows = batchDeduped.filter(
		(r) => !existingLineIds.has(r.import_line_id)
	);

	// Apply saved decisions + keep_import deletions
	const rowsToInsert: typeof candidateRows = [];
	for (const row of candidateRows) {
		const { tx } = row;
		const conflictKey = await buildDuplicateConflictKey(
			account_id,
			tx.date,
			tx.amount
		);
		const resolution = decisionMap.get(conflictKey);

		if (resolution === "keep_existing") {
			continue;
		}

		if (resolution === "keep_import") {
			const { data: clash } = await supabase
				.from("transactions")
				.select("id, amount, date")
				.eq("account_id", account_id)
				.eq("user_id", user.id)
				.is("import_line_id", null)
				.eq("amount", tx.amount);
			if (clash && clash.length > 0) {
				const txDay = calendarDateKeyForDuplicate(tx.date);
				for (const c of clash) {
					if (
						amountsEqualExactCents(Number(c.amount), tx.amount) &&
						calendarDateKeyForDuplicate(String(c.date)) === txDay
					) {
						await deleteTransactionAndAdjustBalance(supabase, user.id, c.id);
					}
				}
			}
		}

		rowsToInsert.push(row);
	}

	candidateRows = rowsToInsert;

	let imported = 0;
	let balanceChange = 0;

	if (candidateRows.length > 0) {
		const uniqueDescriptions = [
			...new Set(candidateRows.map((r) => r.tx.description).filter(Boolean)),
		];

		const categoryMap: Record<
			string,
			{ category_id: string | null; subcategory_id: string | null }
		> = {};

		if (uniqueDescriptions.length > 0) {
			for (let i = 0; i < uniqueDescriptions.length; i += BATCH_SIZE) {
				const batch = uniqueDescriptions.slice(i, i + BATCH_SIZE);
				const { data: existingWithCategories } = await supabase
					.from("transactions")
					.select("description, category_id, subcategory_id, date")
					.eq("user_id", user.id)
					.in("description", batch)
					.not("category_id", "is", null)
					.order("date", { ascending: false });

				if (existingWithCategories) {
					for (const tx of existingWithCategories) {
						if (tx.description && !categoryMap[tx.description]) {
							categoryMap[tx.description] = {
								category_id: tx.category_id,
								subcategory_id: tx.subcategory_id,
							};
						}
					}
				}
			}
		}

		const toInsert = candidateRows.map((r) => {
			const t = r.tx;
			const categories = t.description ? categoryMap[t.description] : null;
			return {
				user_id: user.id,
				account_id,
				amount: t.amount,
				type: t.type,
				date: t.date,
				description: t.description || null,
				external_hash: t.external_hash,
				import_line_id: r.import_line_id,
				category_id: categories?.category_id || null,
				subcategory_id: categories?.subcategory_id || null,
				statement_balance:
					t.statement_balance !== undefined ? t.statement_balance : null,
			};
		});

		const { data: insertedData, error: insertError } = await supabase
			.from("transactions")
			.insert(toInsert)
			.select("id, import_line_id, date, amount, description, external_hash");

		if (insertError) {
			return jsonError(insertError.message, 500);
		}

		imported = insertedData?.length || 0;

		for (const r of candidateRows) {
			const t = r.tx;
			if (t.type === "income") {
				balanceChange += t.amount;
			} else {
				balanceChange -= t.amount;
			}
		}
	}

	let possibleDuplicates: PossibleDuplicate[] = [];

	if (imported > 0) {
		const insertedLineIds = candidateRows.map((r) => r.import_line_id);
		const recentlyInserted: Array<{
			id: string;
			import_line_id: string | null;
			date: string;
			amount: number;
			description: string | null;
			external_hash: string | null;
		}> = [];
		for (let i = 0; i < insertedLineIds.length; i += BATCH_SIZE) {
			const batch = insertedLineIds.slice(i, i + BATCH_SIZE);
			const { data } = await supabase
				.from("transactions")
				.select("id, import_line_id, date, amount, description, external_hash")
				.eq("account_id", account_id)
				.in("import_line_id", batch);
			if (data) recentlyInserted.push(...data);
		}

		if (recentlyInserted.length > 0) {
			possibleDuplicates = await collectPossibleDuplicatesManualVsImport({
				supabase,
				userId: user.id,
				accountId: account_id,
				insertedRows: recentlyInserted,
				decisionMap,
			});
		}
	}

	let newBalance: number = Number(account.balance);
	const hasFinalBalance =
		final_balance !== undefined &&
		final_balance !== null;

	if (hasFinalBalance) {
		newBalance = final_balance!;
		await supabase
			.from("accounts")
			.update({ balance: newBalance })
			.eq("id", account_id);
	} else if (balanceChange !== 0) {
		newBalance = Number(account.balance) + balanceChange;
		await supabase.from("accounts").update({ balance: newBalance }).eq("id", account_id);
	}

	const skippedCount = transactions.length - imported;

	const response: ImportTransactionsResponse = {
		imported,
		skipped: skippedCount,
		total: transactions.length,
		new_balance: newBalance,
		possibleDuplicates:
			possibleDuplicates.length > 0 ? possibleDuplicates : undefined,
	};

	return jsonResponse({ data: response }, 200);
}
