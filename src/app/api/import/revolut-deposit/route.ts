import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";
import type { ImportTransactionsResponse, PossibleDuplicate } from "@/lib/parsers/types";
import { generateTransactionHash } from "@/lib/parsers/utils";

interface RevolutDepositImportRequest {
  parent_account_id: string;
  transactions: Array<{
    date: string;
    amount: number;
    type: "income" | "expense";
    description: string;
    external_hash: string;
  }>;
  final_balance?: number | null;
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
      return jsonError("Failed to create deposit account: " + (createError?.message || "Unknown error"), 500);
    }

    depositAccount = newAccount;
    accountCreated = true;
  }

  const transactionsWithNewHash = await Promise.all(
    transactions.map(async (tx) => {
      const newHash = await generateTransactionHash(
        depositAccount!.id,
        tx.date,
        tx.amount,
        tx.description
      );
      return { ...tx, external_hash: newHash };
    })
  );

  const hashes = transactionsWithNewHash.map((t) => t.external_hash).filter(Boolean);
  
  let existingHashes: Set<string> = new Set();
  if (hashes.length > 0) {
    const { data: existingTransactions } = await supabase
      .from("transactions")
      .select("external_hash")
      .eq("account_id", depositAccount.id)
      .in("external_hash", hashes);

    if (existingTransactions) {
      existingHashes = new Set(
        existingTransactions.map((t) => t.external_hash).filter(Boolean)
      );
    }
  }

  const newTransactions = transactionsWithNewHash.filter(
    (t) => t.external_hash && !existingHashes.has(t.external_hash)
  );

  let imported = 0;
  let balanceChange = 0;
  let latestImportedDate: string | null = null;

  for (const t of newTransactions) {
    if (!latestImportedDate || t.date > latestImportedDate) {
      latestImportedDate = t.date;
    }
  }

  const { data: latestExisting } = await supabase
    .from("transactions")
    .select("date")
    .eq("account_id", depositAccount.id)
    .order("date", { ascending: false })
    .limit(1)
    .single();

  const latestExistingDate = latestExisting?.date as string | undefined;

  if (newTransactions.length > 0) {
    const toInsert = newTransactions.map((t) => ({
      user_id: user.id,
      account_id: depositAccount!.id,
      amount: t.amount,
      type: t.type,
      date: t.date,
      description: t.description || null,
      external_hash: t.external_hash,
      category_id: null,
      subcategory_id: null,
    }));

    const { data: insertedData, error: insertError } = await supabase
      .from("transactions")
      .insert(toInsert)
      .select("id, external_hash, date, amount, description");

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

  const possibleDuplicates: PossibleDuplicate[] = [];

  if (imported > 0) {
    const insertedHashes = newTransactions.map(t => t.external_hash);
    
    const { data: recentlyInserted } = await supabase
      .from("transactions")
      .select("id, external_hash, date, amount, description")
      .eq("account_id", depositAccount.id)
      .in("external_hash", insertedHashes);

    if (recentlyInserted && recentlyInserted.length > 0) {
      const insertedHashSet = new Set(insertedHashes);
      const uniqueDates = [...new Set(recentlyInserted.map(t => t.date))];

      const { data: existingByDate } = await supabase
        .from("transactions")
        .select("id, date, amount, description, external_hash")
        .eq("account_id", depositAccount.id)
        .in("date", uniqueDates);

      if (existingByDate && existingByDate.length > 0) {
        const existingNotInserted = existingByDate.filter(
          t => !t.external_hash || !insertedHashSet.has(t.external_hash)
        );

        for (const inserted of recentlyInserted) {
          const matches = existingNotInserted.filter((existing) => {
            const amountDiff = Math.abs(Number(existing.amount) - Number(inserted.amount));
            return existing.date === inserted.date && amountDiff < 0.02;
          });

          for (const match of matches) {
            possibleDuplicates.push({
              incoming: {
                id: inserted.id,
                date: inserted.date,
                amount: Number(inserted.amount),
                description: inserted.description || "",
                external_hash: inserted.external_hash || "",
              },
              existing: {
                id: match.id,
                description: match.description || "",
                date: match.date,
                amount: Number(match.amount),
              },
            });
          }
        }
      }
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
      .eq("id", depositAccount.id);
  } else if (balanceChange !== 0) {
    newBalance = Number(depositAccount.balance) + balanceChange;
    await supabase
      .from("accounts")
      .update({ balance: newBalance })
      .eq("id", depositAccount.id);
  }

  const importResult: ImportTransactionsResponse = {
    imported,
    skipped: transactions.length - imported,
    total: transactions.length,
    new_balance: newBalance,
    possibleDuplicates: possibleDuplicates.length > 0 ? possibleDuplicates : undefined,
  };

  return jsonResponse({
    data: {
      importResult,
      accountCreated,
      accountId: depositAccount.id,
    },
  }, 200);
}
