import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, unauthorized } from "@/lib/apiHelpers";
import { BANK_PROVIDERS } from "@/lib/bankProviders";
import { importTransactions } from "@/lib/importTransactions";
import type { ImportedTransaction } from "@/lib/parsers/types";
import { generateTransactionHash } from "@/lib/parsers/utils";

const DEPOSIT_ACCOUNT_NAME = "Revolut Remunerada";

/** Imports Revolut savings ("remunerada") rows into a dedicated account, creating it on first use. */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { parent_account_id, transactions, final_balance } = (await request.json()) as {
    parent_account_id?: string;
    transactions?: ImportedTransaction[];
    final_balance?: number | null;
  };
  if (!parent_account_id) return jsonError("missing parent_account_id");
  if (!Array.isArray(transactions) || transactions.length === 0) return jsonError("missing or empty transactions");

  const { data: parent } = await supabase.from("accounts").select("id").eq("id", parent_account_id).eq("user_id", user.id).single();
  if (!parent) return jsonError("Parent account not found", 404);

  let { data: deposit } = await supabase.from("accounts").select("id").eq("user_id", user.id).ilike("name", DEPOSIT_ACCOUNT_NAME).single();
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
    if (error) return jsonError(`Failed to create deposit account: ${error.message}`, 500);
    deposit = data;
  }

  const accountId = deposit.id as string;
  const result = await importTransactions({
    supabase,
    userId: user.id,
    accountId,
    transactions: await Promise.all(
      transactions.map(async (tx) => ({
        ...tx,
        external_hash: await generateTransactionHash(accountId, tx.date, tx.amount, tx.description),
      }))
    ),
    finalBalance: final_balance,
    inheritCategories: false,
  });
  if ("error" in result) return jsonError(result.error, 500);
  return jsonResponse({ data: { importResult: result, accountCreated, accountId } });
}
