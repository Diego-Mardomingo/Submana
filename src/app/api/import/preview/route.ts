import { NextRequest } from "next/server";
import { getAccountAccess, getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { DEPOSIT_ACCOUNT_NAME } from "@/lib/bankProviders";
import { prepareImport, toPreviewRows } from "@/lib/importTransactions";
import { validateImportPayload } from "@/lib/importValidation";
import type { ImportedTransaction, ImportPreviewResponse } from "@/lib/parsers/types";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { attachSettlementSuggestions } from "@/lib/shared/importSettlements";

/**
 * Classifies statement rows (new / sure / possible / already imported / skipped) before importing.
 * Writes nothing. Savings rows are classified against the existing "Revolut Remunerada" account;
 * if it does not exist yet, they are all new.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const limited = await enforceRateLimit(`import-preview:${user.id}`, RATE_LIMITS.importPreview.limit, RATE_LIMITS.importPreview.windowSeconds);
  if (limited) return limited;

  let body: { account_id?: string; transactions?: ImportedTransaction[]; deposit_transactions?: ImportedTransaction[] };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  const { account_id } = body;
  const transactions = body.transactions ?? [];
  const deposit = body.deposit_transactions ?? [];
  if (!account_id) return jsonError("missing account_id");
  if (transactions.length === 0 && deposit.length === 0) return jsonError("missing or empty transactions");
  for (const list of [transactions, deposit]) {
    const payloadError = list.length > 0 ? validateImportPayload(list, null) : null;
    if (payloadError) return jsonError(payloadError);
  }

  const access = await getAccountAccess(supabase, user.id, account_id);
  if (!access) return jsonError("Account not found or access denied", 404);

  try {
    const response: ImportPreviewResponse = { transactions: [], deposit: [] };
    if (transactions.length > 0) {
      const rows = toPreviewRows((await prepareImport({ supabase, userId: user.id, accountId: account_id, transactions, joint: access.isJoint })).rows);
      // Settlement suggestions are personal (shared expenses never live in a joint account).
      response.transactions = access.isJoint ? rows : await attachSettlementSuggestions(supabase, user.id, transactions, rows);
    }
    if (deposit.length > 0) {
      const { data: depositAccount } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", user.id)
        .ilike("name", DEPOSIT_ACCOUNT_NAME)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      response.deposit = depositAccount
        ? toPreviewRows(
            (
              await prepareImport({
                supabase,
                userId: user.id,
                accountId: depositAccount.id as string,
                // The client hashed these rows with a provisional account id; the import recomputes the hash.
                transactions: deposit,
              })
            ).rows
          )
        : deposit.filter((tx) => tx.import_source_fingerprint).map((tx) => ({ fingerprint: tx.import_source_fingerprint, status: "new" as const }));
    }
    return jsonResponse({ data: response });
  } catch (error) {
    return jsonServerError("import/preview", error);
  }
}
