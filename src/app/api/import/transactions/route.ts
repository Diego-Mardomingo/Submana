import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";
import type { ImportTransactionsRequest, ImportTransactionsResponse } from "@/lib/parsers/types";

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

  const hashes = transactions.map((t) => t.external_hash).filter(Boolean);
  
  let existingHashes: Set<string> = new Set();
  if (hashes.length > 0) {
    const { data: existingTransactions } = await supabase
      .from("transactions")
      .select("external_hash")
      .eq("account_id", account_id)
      .in("external_hash", hashes);

    if (existingTransactions) {
      existingHashes = new Set(
        existingTransactions.map((t) => t.external_hash).filter(Boolean)
      );
    }
  }

  const newTransactions = transactions.filter(
    (t) => t.external_hash && !existingHashes.has(t.external_hash)
  );

  let imported = 0;
  let balanceChange = 0;

  if (newTransactions.length > 0) {
    const uniqueDescriptions = [...new Set(
      newTransactions.map((t) => t.description).filter(Boolean)
    )];

    const categoryMap: Record<string, { category_id: string | null; subcategory_id: string | null }> = {};

    if (uniqueDescriptions.length > 0) {
      const { data: existingWithCategories } = await supabase
        .from("transactions")
        .select("description, category_id, subcategory_id, date")
        .eq("user_id", user.id)
        .in("description", uniqueDescriptions)
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

    const toInsert = newTransactions.map((t) => {
      const categories = t.description ? categoryMap[t.description] : null;
      return {
        user_id: user.id,
        account_id,
        amount: t.amount,
        type: t.type,
        date: t.date,
        description: t.description || null,
        external_hash: t.external_hash,
        category_id: categories?.category_id || null,
        subcategory_id: categories?.subcategory_id || null,
      };
    });

    const { data: insertedData, error: insertError } = await supabase
      .from("transactions")
      .insert(toInsert)
      .select();

    if (insertError) {
      return jsonError(insertError.message, 500);
    }

    imported = insertedData?.length || 0;

    for (const t of newTransactions) {
      if (t.type === "income") {
        balanceChange += t.amount;
      } else {
        balanceChange -= t.amount;
      }
    }
  }

  let newBalance: number;
  
  if (final_balance !== undefined && final_balance !== null) {
    newBalance = final_balance;
    await supabase
      .from("accounts")
      .update({ balance: newBalance })
      .eq("id", account_id);
  } else {
    newBalance = Number(account.balance) + balanceChange;
    if (balanceChange !== 0) {
      await supabase
        .from("accounts")
        .update({ balance: newBalance })
        .eq("id", account_id);
    }
  }

  const response: ImportTransactionsResponse = {
    imported,
    skipped: transactions.length - imported,
    total: transactions.length,
    new_balance: newBalance,
  };

  return jsonResponse({ data: response }, 200);
}
