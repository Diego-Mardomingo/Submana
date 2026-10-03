import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { importTransactions } from "@/lib/importTransactions";
import { validateImportPayload, validateResolutions } from "@/lib/importValidation";
import type { ImportedTransaction, ImportResolution } from "@/lib/parsers/types";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const limited = await enforceRateLimit(`import:${user.id}`, RATE_LIMITS.import.limit, RATE_LIMITS.import.windowSeconds);
  if (limited) return limited;

  let body: { account_id?: string; transactions?: ImportedTransaction[]; final_balance?: number | null; resolutions?: ImportResolution[] };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  const { account_id, transactions, final_balance, resolutions } = body;
  if (!account_id) return jsonError("missing account_id");
  const payloadError = validateImportPayload(transactions, final_balance);
  if (payloadError) return jsonError(payloadError);
  const resolutionsError = validateResolutions(resolutions);
  if (resolutionsError) return jsonError(resolutionsError);

  const { data: account } = await supabase.from("accounts").select("id").eq("id", account_id).eq("user_id", user.id).maybeSingle();
  if (!account) return jsonError("Account not found or access denied", 404);

  const result = await importTransactions({
    supabase,
    userId: user.id,
    accountId: account_id,
    transactions: transactions!,
    finalBalance: final_balance,
    inheritCategories: true,
    resolutions,
  });
  return "error" in result ? jsonServerError("import/transactions", result.error) : jsonResponse({ data: result });
}
