import type { SupabaseClient } from "@supabase/supabase-js";
import { adjustAccountBalance, inChunks, signedAmount } from "@/lib/apiHelpers";
import { classifyImportRows, decisionAction, type ClassifyCandidate } from "@/lib/dedup/classifyImport";
import { matchScore } from "@/lib/dedup/matchScore";
import { filterAlreadyImportedStatementRows } from "@/lib/importDuplicateDetection";
import { tagInternalTransfersAfterImport } from "@/lib/importTransferTagging";
import { linkImportedSettlements, type SettlementJob } from "@/lib/shared/importSettlements";
import { buildDuplicateConflictKey, buildDuplicateConflictKeyLegacy, buildImportLineId } from "@/lib/parsers/importKeys";
import type { ImportedTransaction, ImportPreviewRow, ImportResolution, ImportRowStatus, ImportTransactionsResponse } from "@/lib/parsers/types";

const BATCH_SIZE = 80;
const PAGE_SIZE = 1000;
const DAY_MS = 86_400_000;

type Category = { category_id: string | null; subcategory_id: string | null };

/** Unreconciled manual transaction (no bank line attached yet). */
interface ManualCandidate extends ClassifyCandidate {
  type: string;
  amount: number;
  date: string;
  description: string | null;
  category_id: string | null;
}

export interface PreparedRow {
  tx: ImportedTransaction;
  import_line_id: string;
  status: ImportRowStatus;
  match?: ImportPreviewRow["match"];
}

export interface PreparedImport {
  rows: PreparedRow[];
  /** Every manual candidate loaded for the batch, by id (used to revalidate merge targets). */
  candidates: Map<string, ManualCandidate>;
}

/** Reads every page of unreconciled manual transactions of the account with one of `amounts` in [fromIso, toIso]. */
async function fetchManualCandidates(supabase: SupabaseClient, userId: string, accountId: string, amounts: number[], fromIso: string, toIso: string) {
  const rows: ManualCandidate[] = [];
  for (let i = 0; i < amounts.length; i += BATCH_SIZE) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, type, amount, date, description, category_id")
        .eq("user_id", userId)
        .eq("account_id", accountId)
        .is("booked_at", null)
        .in("amount", amounts.slice(i, i + BATCH_SIZE))
        .gte("date", fromIso)
        .lte("date", toIso)
        .order("id")
        .range(from, from + PAGE_SIZE - 1);
      if (error || !data) break;
      rows.push(...data.map((r) => ({ ...r, amount: Number(r.amount) })));
      if (data.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

/**
 * Classifies statement rows without writing anything: layer A (same import_line_id), layer B
 * (same bank row re-exported with other data), saved decisions and, for the rest, a single batched
 * lookup of unreconciled manual transactions scored by classifyImportRows.
 */
export async function prepareImport(args: {
  supabase: SupabaseClient;
  userId: string;
  accountId: string;
  transactions: ImportedTransaction[];
}): Promise<PreparedImport> {
  const { supabase, userId, accountId, transactions } = args;

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
  const layerA = [...byLineId.values()].filter((r) => !existingIds.has(r.import_line_id));
  const notReimported = new Set(await filterAlreadyImportedStatementRows({ supabase, accountId, rows: layerA }));

  const prepared: PreparedRow[] = [];
  const pending: PreparedRow[] = [];
  const pendingDecisions: (string | undefined)[] = [];
  for (const row of byLineId.values()) {
    if (existingIds.has(row.import_line_id) || !notReimported.has(row)) {
      prepared.push({ ...row, status: "already_imported" });
      continue;
    }
    const { tx } = row;
    pending.push({ ...row, status: "new" });
    pendingDecisions.push(
      decisions.get(row.import_line_id) ??
        decisions.get(await buildDuplicateConflictKey(accountId, tx.date, tx.amount, tx.type)) ??
        decisions.get(await buildDuplicateConflictKeyLegacy(accountId, tx.date, tx.amount))
    );
  }

  // Lines still undecided are the only ones worth looking up manual twins for.
  const lookup = pending.filter((_, i) => !decisionAction(pendingDecisions[i]));
  const candidates = new Map<string, ManualCandidate>();
  if (lookup.length > 0) {
    const times = lookup.map((r) => new Date(r.tx.date).getTime());
    // Manual day is bank day -5..+2; one extra day absorbs time zone edges (the exact gate runs on calendar days).
    const fromIso = new Date(Math.min(...times) - 6 * DAY_MS).toISOString();
    const toIso = new Date(Math.max(...times) + 3 * DAY_MS).toISOString();
    const amounts = [...new Set(lookup.map((r) => Number(r.tx.amount)))];
    for (const c of await fetchManualCandidates(supabase, userId, accountId, amounts, fromIso, toIso)) candidates.set(c.id, c);
  }

  const classified = classifyImportRows(
    pending.map((r, i) => ({ ...r.tx, decision: pendingDecisions[i] })),
    [...candidates.values()]
  );
  pending.forEach((row, i) => {
    const { status, match } = classified[i];
    row.status = status;
    if (match) {
      const c = match.candidate;
      row.match = {
        id: c.id,
        date: c.date,
        description: c.description,
        amount: c.amount,
        category_id: c.category_id,
        score: match.score,
        deltaDays: match.deltaDays,
        descScore: match.descScore,
      };
    }
  });
  return { rows: [...prepared, ...pending], candidates };
}

/** Per-line classification for the preview endpoint. */
export const toPreviewRows = (rows: PreparedRow[]): ImportPreviewRow[] =>
  rows.map((r) => ({ fingerprint: r.tx.import_source_fingerprint, status: r.status, ...(r.match && { match: r.match }) }));

/** True when the manual transaction `id` can still absorb `tx`: owned, same account, unreconciled and passing the hard gates. */
async function canMerge(args: {
  supabase: SupabaseClient;
  userId: string;
  accountId: string;
  tx: ImportedTransaction;
  id: string;
  known: Map<string, ManualCandidate>;
}) {
  const { supabase, userId, accountId, tx, id, known } = args;
  let target: Pick<ManualCandidate, "type" | "amount" | "date" | "description"> | null | undefined = known.get(id);
  if (!target) {
    const { data } = await supabase
      .from("transactions")
      .select("type, amount, date, description")
      .eq("id", id)
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .is("booked_at", null)
      .maybeSingle();
    target = data;
  }
  return !!target && matchScore(tx, target) !== null;
}

/**
 * Imports parsed statement rows into an account. Rows already imported are skipped; the rest follow
 * the user's `resolutions` (merge into a manual transaction / insert / skip) or, without one, `sure`
 * matches are merged and everything else is inserted. Optionally inherits categories from earlier
 * transactions with the same description, tags internal transfers and updates the balance.
 */
export async function importTransactions(args: {
  supabase: SupabaseClient;
  userId: string;
  accountId: string;
  transactions: ImportedTransaction[];
  finalBalance?: number | null;
  inheritCategories: boolean;
  resolutions?: ImportResolution[];
}): Promise<ImportTransactionsResponse | { error: string }> {
  const { supabase, userId, accountId, transactions, finalBalance, inheritCategories, resolutions } = args;

  const prepared = await prepareImport({ supabase, userId, accountId, transactions });
  const chosen = new Map((resolutions ?? []).map((r) => [r.fingerprint, r]));

  const toInsert: PreparedRow[] = [];
  const toSkip: PreparedRow[] = [];
  const mergeTargets = new Set<string>();
  const settlementJobs: SettlementJob[] = [];
  let merged = 0;

  for (const row of prepared.rows) {
    if (row.status === "already_imported" || row.status === "skipped") continue;
    const choice = chosen.get(row.tx.import_source_fingerprint);
    if (choice?.action === "skip") {
      toSkip.push(row);
      continue;
    }
    const wantsMerge = choice ? choice.action === "merge" : row.status === "sure";
    const targetId = choice?.target_id ?? row.match?.id;
    if (wantsMerge && targetId && !mergeTargets.has(targetId) && (await canMerge({ supabase, userId, accountId, tx: row.tx, id: targetId, known: prepared.candidates }))) {
      const { tx } = row;
      // The manual row already moved the balance: only attach the bank identity.
      const { data, error } = await supabase.rpc("merge_bank_line_into_transaction", {
        p_user_id: userId,
        p_tx_id: targetId,
        p_import_line_id: row.import_line_id,
        p_external_hash: tx.external_hash ?? null,
        p_statement_balance: tx.statement_balance ?? null,
        p_booked_at: tx.date,
        p_bank_description: tx.description || null,
      });
      if (!error && data?.id) {
        mergeTargets.add(targetId);
        merged++;
        if (choice?.settlement) {
          settlementJobs.push({ txId: targetId, type: tx.type, amount: tx.amount, date: tx.date, settlement: choice.settlement });
        }
        continue;
      }
    }
    toInsert.push(row);
  }

  if (toSkip.length > 0) {
    await supabase.from("import_duplicate_decisions").upsert(
      toSkip.map((r) => ({ user_id: userId, account_id: accountId, conflict_key: r.import_line_id, resolution: "skip_bank_line" })),
      { onConflict: "user_id,account_id,conflict_key" }
    );
  }

  const categories = new Map<string, Category>();
  if (inheritCategories) {
    const descriptions = [...new Set(toInsert.map((r) => r.tx.description).filter(Boolean))];
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
  if (toInsert.length > 0) {
    const { data: inserted, error } = await supabase
      .from("transactions")
      .insert(
        toInsert.map(({ tx, import_line_id }) => ({
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
          source: "import",
          booked_at: tx.date,
          bank_description: tx.description || null,
        }))
      )
      .select("id, import_line_id");
    if (error) return { error: error.message };

    imported = inserted.length;
    const insertedByLine = new Map(inserted.map((t) => [t.import_line_id as string, t.id as string]));
    for (const { tx, import_line_id } of toInsert) {
      const settlement = chosen.get(tx.import_source_fingerprint)?.settlement;
      const txId = insertedByLine.get(import_line_id);
      if (settlement && txId) settlementJobs.push({ txId, type: tx.type, amount: tx.amount, date: tx.date, settlement });
    }
    tagged = await tagInternalTransfersAfterImport({ supabase, userId, insertedIds: inserted.map((t) => t.id) });
  }

  // The statement's balance is the source of truth; otherwise apply the net change of the inserted rows
  // (merged manual rows already moved the balance when they were created).
  if (finalBalance != null) await supabase.from("accounts").update({ balance: finalBalance }).eq("id", accountId).eq("user_id", userId);
  else await adjustAccountBalance(supabase, userId, accountId, toInsert.reduce((sum, r) => sum + signedAmount(r.tx), 0));
  const settlementsLinked = await linkImportedSettlements(supabase, userId, settlementJobs);
  const { data: account } = await supabase.from("accounts").select("balance").eq("id", accountId).eq("user_id", userId).single();

  return {
    imported,
    merged,
    skipped: transactions.length - imported - merged,
    total: transactions.length,
    new_balance: Number(account?.balance ?? 0),
    internal_transfers_tagged: tagged,
    ...(settlementsLinked > 0 && { settlements_linked: settlementsLinked }),
  };
}
