import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse, jsonServerError } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";
import type { ImportTransactionsRequest } from "@/lib/parsers/types";
import { validateImportPayload } from "@/lib/importValidation";
import { runStatementImport } from "@/lib/importPipeline";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

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

	let body: ImportTransactionsRequest;
	try {
		body = (await request.json()) as ImportTransactionsRequest;
	} catch {
		return jsonError("Invalid JSON body");
	}
	const { account_id, transactions, final_balance } = body;

	if (!account_id) {
		return jsonError("missing account_id");
	}
	const payloadError = validateImportPayload(transactions, final_balance);
	if (payloadError) {
		return jsonError(payloadError);
	}

	const { data: account, error: accountError } = await supabase
		.from("accounts")
		.select("id, balance")
		.eq("id", account_id)
		.eq("user_id", user.id)
		.single();

	if (accountError || !account) {
		return jsonError("Account not found or access denied", 404);
	}

	try {
		const result = await runStatementImport({
			supabase,
			userId: user.id,
			accountId: account_id,
			currentBalance: Number(account.balance),
			transactions,
			finalBalance: final_balance,
			autoCategorize: true,
		});
		return jsonResponse({ data: result }, 200);
	} catch (err) {
		return jsonServerError("import/transactions", err);
	}
}
