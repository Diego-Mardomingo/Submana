import { NextRequest } from "next/server";
import { getAccountAccess, getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { BANK_PROVIDERS, DEPOSIT_ACCOUNT_NAME } from "@/lib/bankProviders";
import { importTransactions } from "@/lib/importTransactions";
import { watchImportBudgets } from "@/lib/notifications/budgets";
import { notifyImport } from "@/lib/notifications/events/imports";
import { validateImportPayload, validateResolutions } from "@/lib/importValidation";
import type { ImportedTransaction, ImportResolution } from "@/lib/parsers/types";
import { generateTransactionHash } from "@/lib/parsers/utils";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

/** Imports Revolut savings ("remunerada") rows into a dedicated account, creating it on first use. */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const limited = await enforceRateLimit(`import:${user.id}`, RATE_LIMITS.import.limit, RATE_LIMITS.import.windowSeconds);
  if (limited) return limited;

  let body: { parent_account_id?: string; transactions?: ImportedTransaction[]; final_balance?: number | null; resolutions?: ImportResolution[] };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  const { parent_account_id, transactions, final_balance, resolutions } = body;
  if (!parent_account_id) return jsonError("missing parent_account_id");
  const payloadError = validateImportPayload(transactions, final_balance);
  if (payloadError) return jsonError(payloadError);
  const resolutionsError = validateResolutions(resolutions);
  if (resolutionsError) return jsonError(resolutionsError);

  if (!(await getAccountAccess(supabase, user.id, parent_account_id))) return jsonError("Parent account not found", 404);

  let { data: deposit } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", user.id)
    .ilike("name", DEPOSIT_ACCOUNT_NAME)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const accountCreated = !deposit;
  if (!deposit) {
    const { data, error } = await supabase
      .from("accounts")
      .insert({
        user_id: user.id,
        name: DEPOSIT_ACCOUNT_NAME,
        balance: 0,
        icon: BANK_PROVIDERS.revolut.icon,
        color: "#22d3ee",
        bank_provider: "revolut",
        is_default: false,
      })
      .select("id")
      .single();
    if (error || !data) return jsonServerError("import/revolut-deposit create account", error);
    deposit = data;
  }

  const accountId = deposit.id as string;
  // The client hashed with a provisional id: the account might not exist yet.
  const rows = await Promise.all(
    transactions!.map(async (tx) => ({
      ...tx,
      external_hash: await generateTransactionHash(accountId, tx.date, tx.amount, tx.description),
    }))
  );
  const budgets = await watchImportBudgets(supabase, user.id, rows);
  const result = await importTransactions({
    supabase,
    userId: user.id,
    accountId,
    transactions: rows,
    finalBalance: final_balance,
    inheritCategories: false,
    resolutions,
  });
  if ("error" in result) return jsonServerError("import/revolut-deposit", result.error);

  notifyImport({ accountId, imported: result.imported, joint: false, actorId: user.id });
  const crossedBudgets = await budgets.finish();
  return jsonResponse({ data: { importResult: { ...result, crossedBudgets }, accountCreated, accountId } });
}
