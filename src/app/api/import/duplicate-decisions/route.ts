import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse, parseRequestBody } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
	const supabase = await createClient();
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return jsonError("Unauthorized", 401);
	}

	const { searchParams } = new URL(request.url);
	const accountId = searchParams.get("account_id");

	let query = supabase
		.from("import_duplicate_decisions")
		.select("id, account_id, conflict_key, resolution, created_at")
		.eq("user_id", user.id)
		.order("created_at", { ascending: false });

	if (accountId) {
		query = query.eq("account_id", accountId);
	}

	const { data, error } = await query;

	if (error) {
		return jsonError(error.message, 500);
	}

	return jsonResponse({ data: data ?? [] }, 200);
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

	const { body } = await parseRequestBody(request);
	const account_id = body.account_id as string | undefined;
	const conflict_key = body.conflict_key as string | undefined;
	const resolution = body.resolution as string | undefined;

	if (!account_id || !conflict_key || !resolution) {
		return jsonError("missing account_id, conflict_key or resolution");
	}

	if (resolution !== "keep_existing" && resolution !== "keep_import") {
		return jsonError("invalid resolution");
	}

	const { data: account } = await supabase
		.from("accounts")
		.select("id")
		.eq("id", account_id)
		.eq("user_id", user.id)
		.single();

	if (!account) {
		return jsonError("Account not found", 404);
	}

	const { data, error } = await supabase
		.from("import_duplicate_decisions")
		.upsert(
			{
				user_id: user.id,
				account_id,
				conflict_key,
				resolution,
			},
			{ onConflict: "user_id,account_id,conflict_key" }
		)
		.select()
		.single();

	if (error) {
		return jsonError(error.message, 500);
	}

	return jsonResponse({ data }, 200);
}

export async function DELETE(request: NextRequest) {
	const supabase = await createClient();
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return jsonError("Unauthorized", 401);
	}

	const { searchParams } = new URL(request.url);
	const accountId = searchParams.get("account_id");
	const conflictKey = searchParams.get("conflict_key");

	if (!accountId || !conflictKey) {
		return jsonError("missing account_id or conflict_key");
	}

	const { error } = await supabase
		.from("import_duplicate_decisions")
		.delete()
		.eq("user_id", user.id)
		.eq("account_id", accountId)
		.eq("conflict_key", conflictKey);

	if (error) {
		return jsonError(error.message, 500);
	}

	return jsonResponse({ data: { success: true } }, 200);
}
