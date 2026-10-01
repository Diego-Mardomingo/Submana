import type { SupabaseClient } from "@supabase/supabase-js";
import { adjustAccountBalance, inChunks, signedAmount } from "@/lib/apiHelpers";
import { calendarDayInAppTimeZone } from "@/lib/date";
import { collectPossibleDuplicatesManualVsImport, filterAlreadyImportedStatementRows, toCents } from "@/lib/importDuplicateDetection";
import { tagInternalTransfersAfterImport } from "@/lib/importTransferTagging";
import { buildDuplicateConflictKey, buildDuplicateConflictKeyLegacy, buildImportLineId } from "@/lib/parsers/importKeys";
import type { ImportedTransaction, ImportTransactionsResponse } from "@/lib/parsers/types";

const BATCH_SIZE = 80;

type Category = { category_id: string | null; subcategory_id: string | null };

/** Deletes the manual twin of an imported row (user chose "keep import") and atomically reverts its balance effect. */
async function deleteManualTwin(supabase: SupabaseClient, userId: string, accountId: string, tx: ImportedTransaction) {
  const { data: clash } = await supabase
    .from("transactions")
    .select("id, amount, type, date")
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .is("import_line_id", null)
    .eq("amount", tx.amount)
    .eq("type", tx.type);
  const day = calendarDayInAppTimeZone(tx.date);
  for (const c of clash ?? []) {
    if (toCents(c.amount) !== toCents(tx.amount) || calendarDayInAppTimeZone(String(c.date)) !== day) continue;
    await supabase.rpc("delete_transaction_with_balance", { p_id: c.id, p_user_id: userId, p_adjust_balance: true });
  }
}

/**
 * Imports parsed statement rows into an account: skips rows already imported, applies saved
 * duplicate decisions, optionally inherits categories from previous transactions with the same
 * description, tags internal transfers, reports manual-vs-import duplicates and updates the balance.
 */
export async function importTransactions(args: {
  supabase: SupabaseClient;
  userId: string;
  accountId: string;
  transactions: ImportedTransaction[];
  finalBalance?: number | null;
  inheritCategories: boolean;
}): Promise<ImportTransactionsResponse | { error: string }> {
  const { supabase, userId, accountId, transactions, finalBalance, inheritCategories } = args;

  const { data: decisionRows } = await supabase
    .from("import_duplicate_decisions")
    .select("conflict_key, resolution")
    .eq("user_id", userId)
    .eq("account_id", accountId);
  const decisions = new Map((decisionRows ?? []).map((r) => [r.conflict_key as string, r.resolution as string]));

  // One row per import line id (first occurrence wins); rows without a fingerprint are ignored.
  const lineIds = await Promise.all(
    transactions.map((tx) => (tx.import_source_fingerprint ? buildImportLineId(accountId, tx.import_source_fingerprint) : null))
  );
  const byLineId = new Map<string, { tx: ImportedTransaction; import_line_id: string }>();
  transactions.forEach((tx, i) => {
    const id = lineIds[i];
    if (id && !byLineId.has(id)) byLineId.set(id, { tx, import_line_id: id });
  });

  const existing = await inChunks([...byLineId.keys()], BATCH_SIZE, (ids) =>
    supabase.from("transactions").select("import_line_id").eq("account_id", accountId).in("import_line_id", ids)
  );
  const existingIds = new Set(existing.map((r) => r.import_line_id as string));
  const candidates = await filterAlreadyImportedStatementRows({
    supabase,
    accountId,
    rows: [...byLineId.values()].filter((r) => !existingIds.has(r.import_line_id)),
  });

  const rows: typeof candidates = [];
  for (const row of candidates) {
    const { tx } = row;
    const resolution =
      decisions.get(await buildDuplicateConflictKey(accountId, tx.date, tx.amount, tx.type)) ??
      decisions.get(await buildDuplicateConflictKeyLegacy(accountId, tx.date, tx.amount));
    if (resolution === "keep_existing") continue;
    if (resolution === "keep_import") await deleteManualTwin(supabase, userId, accountId, tx);
    rows.push(row);
  }

  const categories = new Map<string, Category>();
  if (inheritCategories) {
    const descriptions = [...new Set(rows.map((r) => r.tx.description).filter(Boolean))];
    const prior = await inChunks(descriptions, BATCH_SIZE, (batch) =>
      supabase
        .from("transactions")
        .select("description, category_id, subcategory_id")
        .eq("user_id", userId)
        .in("description", batch)
        .not("category_id", "is", null)
        .order("date", { ascending: false })
    );
    for (const p of prior) if (!categories.has(p.description)) categories.set(p.description, p);
  }

  let imported = 0;
  let tagged = 0;
  let possibleDuplicates: ImportTransactionsResponse["possibleDuplicates"];
  if (rows.length > 0) {
    const { data: inserted, error } = await supabase
      .from("transactions")
      .insert(
        rows.map(({ tx, import_line_id }) => ({
          user_id: userId,
          account_id: accountId,
          amount: tx.amount,
          type: tx.type,
          date: tx.date,
          description: tx.description || null,
          external_hash: tx.external_hash,
          import_line_id,
          category_id: categories.get(tx.description)?.category_id ?? null,
          subcategory_id: categories.get(tx.description)?.subcategory_id ?? null,
          statement_balance: tx.statement_balance ?? null,
        }))
      )
      .select("id, import_line_id, date, amount, type, description, external_hash");
    if (error) return { error: error.message };

    imported = inserted.length;
    tagged = await tagInternalTransfersAfterImport({ supabase, userId, insertedIds: inserted.map((t) => t.id) });
    const duplicates = await collectPossibleDuplicatesManualVsImport({ supabase, userId, accountId, insertedRows: inserted, decisionMap: decisions });
    if (duplicates.length > 0) possibleDuplicates = duplicates;
  }

  // The statement's balance is the source of truth; otherwise apply the net change atomically.
  if (finalBalance != null) await supabase.from("accounts").update({ balance: finalBalance }).eq("id", accountId).eq("user_id", userId);
  else await adjustAccountBalance(supabase, userId, accountId, rows.reduce((sum, r) => sum + signedAmount(r.tx), 0));
  const { data: account } = await supabase.from("accounts").select("balance").eq("id", accountId).eq("user_id", userId).single();

  return {
    imported,
    skipped: transactions.length - imported,
    total: transactions.length,
    new_balance: Number(account?.balance ?? 0),
    internal_transfers_tagged: tagged,
    possibleDuplicates,
  };
}
