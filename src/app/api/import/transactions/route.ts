import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, unauthorized } from "@/lib/apiHelpers";
import { importTransactions } from "@/lib/importTransactions";
import type { ImportedTransaction } from "@/lib/parsers/types";

export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { account_id, transactions, final_balance } = (await request.json()) as {
    account_id?: string;
    transactions?: ImportedTransaction[];
    final_balance?: number | null;
  };
  if (!account_id) return jsonError("missing account_id");
  if (!Array.isArray(transactions) || transactions.length === 0) return jsonError("missing or empty transactions");

  const { data: account } = await supabase.from("accounts").select("id").eq("id", account_id).eq("user_id", user.id).single();
  if (!account) return jsonError("Account not found or access denied", 404);

  const result = await importTransactions({
    supabase,
    userId: user.id,
    accountId: account_id,
    transactions,
    finalBalance: final_balance,
    inheritCategories: true,
  });
  return "error" in result ? jsonError(result.error, 500) : jsonResponse({ data: result });
}
