import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";
import type {
	ImportTransactionsResponse,
	ImportedTransaction,
	PossibleDuplicate,
} from "@/lib/parsers/types";
import { generateTransactionHash } from "@/lib/parsers/utils";
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

interface RevolutDepositImportRequest {
	parent_account_id: string;
	transactions: ImportedTransaction[];
	final_balance?: number | null;
}

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

	const body = await request.json() as RevolutDepositImportRequest;
	const { parent_account_id, transactions, final_balance } = body;

	if (!parent_account_id) {
		return jsonError("missing parent_account_id");
	}
	if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
		return jsonError("missing or empty transactions");
	}

	const { data: parentAccount, error: parentError } = await supabase
		.from("accounts")
		.select("id, name, user_id")
		.eq("id", parent_account_id)
		.eq("user_id", user.id)
		.single();

	if (parentError || !parentAccount) {
		return jsonError("Parent account not found", 404);
	}

	let depositAccount: { id: string; balance: number } | null = null;
	let accountCreated = false;

	const { data: existingDeposit } = await supabase
		.from("accounts")
		.select("id, balance")
		.eq("user_id", user.id)
		.ilike("name", "Revolut Remunerada")
		.single();

	if (existingDeposit) {
		depositAccount = existingDeposit;
	} else {
		const { data: newAccount, error: createError } = await supabase
			.from("accounts")
			.insert({
				user_id: user.id,
				name: "Revolut Remunerada",
				balance: 0,
				icon: "https://cdn.brandfetch.io/revolut.com/w/400/h/400?c=1id-tf6xJEAcHu0Tio1",
				color: "#22d3ee",
				bank_provider: "revolut",
				is_default: false,
			})
			.select("id, balance")
			.single();

		if (createError || !newAccount) {
			return jsonError(
				"Failed to create deposit account: " + (createError?.message || "Unknown error"),
				500
			);
		}

		depositAccount = newAccount;
		accountCreated = true;
	}

	const depositId = depositAccount!.id;

	const { data: decisionRows } = await supabase
		.from("import_duplicate_decisions")
		.select("conflict_key, resolution")
		.eq("user_id", user.id)
		.eq("account_id", depositId);

	const decisionMap = new Map<string, string>();
	for (const row of (decisionRows || []) as DuplicateDecisionRow[]) {
		decisionMap.set(row.conflict_key, row.resolution);
	}

	const enriched = await Promise.all(
		transactions.map(async (tx) => {
			if (!tx.import_source_fingerprint) return null;
			const external_hash = await generateTransactionHash(
				depositId,
				tx.date,
				tx.amount,
				tx.description
			);
			const import_line_id = await buildImportLineId(
				depositId,
				tx.import_source_fingerprint
			);
			return { tx: { ...tx, external_hash }, import_line_id };
		})
	);

	const validRows = enriched.filter(
		(x): x is NonNullable<typeof x> => x !== null
	);

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
			.eq("account_id", depositId)
			.in("import_line_id", batch);
		if (data) {
			data.forEach((t) => t.import_line_id && existingLineIds.add(t.import_line_id));
		}
	}

	let candidateRows = batchDeduped.filter(
		(r) => !existingLineIds.has(r.import_line_id)
	);

	const rowsToInsert: typeof candidateRows = [];
	for (const row of candidateRows) {
		const { tx } = row;
		const conflictKey = await buildDuplicateConflictKey(
			depositId,
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
				.eq("account_id", depositId)
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
	let latestImportedDate: string | null = null;

	for (const r of candidateRows) {
		if (!latestImportedDate || r.tx.date > latestImportedDate) {
			latestImportedDate = r.tx.date;
		}
	}

	const { data: latestExisting } = await supabase
		.from("transactions")
		.select("date")
		.eq("account_id", depositId)
		.order("date", { ascending: false })
		.limit(1)
		.single();

	const latestExistingDate = latestExisting?.date as string | undefined;

	if (candidateRows.length > 0) {
		const toInsert = candidateRows.map((r) => ({
			user_id: user.id,
			account_id: depositId,
			amount: r.tx.amount,
			type: r.tx.type,
			date: r.tx.date,
			description: r.tx.description || null,
			external_hash: r.tx.external_hash,
			import_line_id: r.import_line_id,
			category_id: null,
			subcategory_id: null,
			statement_balance:
				r.tx.statement_balance !== undefined ? r.tx.statement_balance : null,
		}));

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
				.eq("account_id", depositId)
				.in("import_line_id", batch);
			if (data) recentlyInserted.push(...data);
		}

		if (recentlyInserted.length > 0) {
			possibleDuplicates = await collectPossibleDuplicatesManualVsImport({
				supabase,
				userId: user.id,
				accountId: depositId,
				insertedRows: recentlyInserted,
				decisionMap,
			});
		}
	}

	let newBalance: number = Number(depositAccount.balance);
	const shouldUseFinalBalance =
		final_balance !== undefined &&
		final_balance !== null &&
		latestImportedDate &&
		(!latestExistingDate || latestImportedDate >= latestExistingDate);

	if (shouldUseFinalBalance) {
		newBalance = final_balance!;
		await supabase
			.from("accounts")
			.update({ balance: newBalance })
			.eq("id", depositId);
	} else if (balanceChange !== 0) {
		newBalance = Number(depositAccount.balance) + balanceChange;
		await supabase
			.from("accounts")
			.update({ balance: newBalance })
			.eq("id", depositId);
	}

	const importResult: ImportTransactionsResponse = {
		imported,
		skipped: transactions.length - imported,
		total: transactions.length,
		new_balance: newBalance,
		possibleDuplicates:
			possibleDuplicates.length > 0 ? possibleDuplicates : undefined,
	};

	return jsonResponse(
		{
			data: {
				importResult,
				accountCreated,
				accountId: depositId,
			},
		},
		200
	);
}
