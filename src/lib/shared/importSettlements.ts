import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportedTransaction, ImportPreviewRow, ImportSettlementChoice } from "@/lib/parsers/types";
import { loadOwedPairs } from "./server";
import { suggestSettlements } from "./settlementMatch";
import { toCents } from "./splits";

/**
 * Attaches a settlement suggestion to preview rows that look like a repayment between friends
 * (an income from someone who owes me, an expense to someone I owe). Only rows that would be inserted.
 */
export async function attachSettlementSuggestions(
  supabase: SupabaseClient,
  userId: string,
  transactions: ImportedTransaction[],
  rows: ImportPreviewRow[]
): Promise<ImportPreviewRow[]> {
  const eligible = new Set(rows.filter((r) => r.status === "new" || r.status === "possible").map((r) => r.fingerprint));
  if (eligible.size === 0) return rows;
  const { pairs, profiles } = await loadOwedPairs(supabase, userId);
  if (pairs.length === 0) return rows;

  const suggestions = new Map(
    suggestSettlements(
      transactions
        .filter((tx) => eligible.has(tx.import_source_fingerprint))
        .map((tx) => ({ id: tx.import_source_fingerprint, type: tx.type, amount: tx.amount, date: tx.date, description: tx.description })),
      pairs
    ).map((s) => [s.txId, s])
  );
  return rows.map((row) => {
    const s = suggestions.get(row.fingerprint);
    const friend = s && profiles.get(s.friendId);
    return s && friend
      ? {
          ...row,
          settlementSuggestion: {
            group_id: s.groupId,
            friend_id: s.friendId,
            friend_handle: friend.handle,
            friend_name: friend.display_name,
            direction: s.direction,
            amount_cents: s.amountCents,
            exact: s.exact,
            score: s.score,
          },
        }
      : row;
  });
}

export interface SettlementJob {
  txId: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  settlement: ImportSettlementChoice;
}

/**
 * Records and links the settlements the user accepted during an import. Everything is revalidated
 * against the current balances (direction and amount); a job that no longer fits is skipped.
 * Returns how many were linked.
 */
export async function linkImportedSettlements(supabase: SupabaseClient, userId: string, jobs: SettlementJob[]) {
  if (jobs.length === 0) return 0;
  const { pairs } = await loadOwedPairs(supabase, userId);
  let linked = 0;
  for (const job of jobs) {
    const pair = pairs.find((p) => p.groupId === job.settlement.group_id && p.friendId === job.settlement.friend_id);
    const cents = toCents(job.amount);
    if (!pair || cents <= 0 || cents > Math.abs(pair.cents)) continue;
    // income: the friend pays me (they owed me); expense: I pay them (I owed them)
    if (job.type === "income" ? pair.cents <= 0 : pair.cents >= 0) continue;
    const { error } = await supabase.rpc("record_settlement", {
      p_group_id: pair.groupId,
      p_from: job.type === "income" ? pair.friendId : userId,
      p_to: job.type === "income" ? userId : pair.friendId,
      p_amount: cents / 100,
      p_date: job.date,
      p_tx_id: job.txId,
    });
    if (error) console.error("[import/settlement]", error);
    else {
      linked++;
      pair.cents += job.type === "income" ? -cents : cents;
    }
  }
  return linked;
}
