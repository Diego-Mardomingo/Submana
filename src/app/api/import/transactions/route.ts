import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse } from "@/lib/apiHelpers";
import { NextRequest } from "next/server";
import type { ImportTransactionsRequest, ImportTransactionsResponse, PossibleDuplicate } from "@/lib/parsers/types";

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

  // Deduplicar dentro del lote por external_hash (fecha + importe + descripción = duplicado exacto, no insertar)
  const seenHashes = new Set<string>();
  const dedupedTransactions = transactions.filter((t) => {
    if (!t.external_hash) return false;
    if (seenHashes.has(t.external_hash)) return false;
    seenHashes.add(t.external_hash);
    return true;
  });

  const hashes = dedupedTransactions.map((t) => t.external_hash).filter(Boolean);
  
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

  const newTransactions = dedupedTransactions.filter(
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
    .eq("account_id", account_id)
    .order("date", { ascending: false })
    .limit(1)
    .single();
  
  const latestExistingDate = latestExisting?.date as string | undefined;

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
      .eq("account_id", account_id)
      .in("external_hash", insertedHashes);

    if (recentlyInserted && recentlyInserted.length > 0) {
      const insertedHashSet = new Set(insertedHashes);
      const uniqueDates = [...new Set(recentlyInserted.map(t => t.date))];
      
      const { data: existingByDate } = await supabase
        .from("transactions")
        .select("id, date, amount, description, external_hash")
        .eq("account_id", account_id)
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

  let newBalance: number = Number(account.balance);
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
      .eq("id", account_id);
  } else if (balanceChange !== 0) {
    newBalance = Number(account.balance) + balanceChange;
    await supabase
      .from("accounts")
      .update({ balance: newBalance })
      .eq("id", account_id);
  }

  const response: ImportTransactionsResponse = {
    imported,
    skipped: transactions.length - imported,
    total: transactions.length,
    new_balance: newBalance,
    possibleDuplicates: possibleDuplicates.length > 0 ? possibleDuplicates : undefined,
  };

  return jsonResponse({ data: response }, 200);
}
