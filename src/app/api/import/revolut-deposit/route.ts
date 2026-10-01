import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse, jsonServerError } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";
import type { ImportedTransaction } from "@/lib/parsers/types";
import { validateImportPayload } from "@/lib/importValidation";
import { runStatementImport } from "@/lib/importPipeline";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

interface RevolutDepositImportRequest {
	parent_account_id: string;
	transactions: ImportedTransaction[];
	final_balance?: number | null;
}

const DEPOSIT_ACCOUNT_NAME = "Revolut Remunerada";

export async function POST(request: NextRequest) {
	const supabase = await createClient();
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return jsonError("Unauthorized", 401);
	}

	const limited = await enforceRateLimit(
		`import:${user.id}`,
		RATE_LIMITS.import.limit,
		RATE_LIMITS.import.windowSeconds
	);
	if (limited) return limited;

	let body: RevolutDepositImportRequest;
	try {
		body = (await request.json()) as RevolutDepositImportRequest;
	} catch {
		return jsonError("Invalid JSON body");
	}
	const { parent_account_id, transactions, final_balance } = body;

	if (!parent_account_id) {
		return jsonError("missing parent_account_id");
	}
	const payloadError = validateImportPayload(transactions, final_balance);
	if (payloadError) {
		return jsonError(payloadError);
	}

	const { data: parentAccount } = await supabase
		.from("accounts")
		.select("id")
		.eq("id", parent_account_id)
		.eq("user_id", user.id)
		.maybeSingle();

	if (!parentAccount) {
		return jsonError("Parent account not found", 404);
	}

	let accountCreated = false;
	let { data: depositAccount } = await supabase
		.from("accounts")
		.select("id, balance")
		.eq("user_id", user.id)
		.ilike("name", DEPOSIT_ACCOUNT_NAME)
		.order("created_at", { ascending: true })
		.limit(1)
		.maybeSingle();

	if (!depositAccount) {
		const { data: newAccount, error: createError } = await supabase
			.from("accounts")
			.insert({
				user_id: user.id,
				name: DEPOSIT_ACCOUNT_NAME,
				balance: 0,
				icon: "https://cdn.brandfetch.io/revolut.com/w/400/h/400?c=1id-tf6xJEAcHu0Tio1",
				color: "#22d3ee",
				bank_provider: "revolut",
				is_default: false,
			})
			.select("id, balance")
			.single();

		if (createError || !newAccount) {
			return jsonServerError("import/revolut-deposit create account", createError);
		}

		depositAccount = newAccount;
		accountCreated = true;
	}

	try {
		const importResult = await runStatementImport({
			supabase,
			userId: user.id,
			accountId: depositAccount.id,
			currentBalance: Number(depositAccount.balance),
			transactions,
			finalBalance: final_balance,
			// El cliente calculó el hash con un id provisional: la cuenta aún podía no existir.
			recomputeExternalHash: true,
		});
		return jsonResponse(
			{ data: { importResult, accountCreated, accountId: depositAccount.id } },
			200
		);
	} catch (err) {
		return jsonServerError("import/revolut-deposit", err);
	}
}
