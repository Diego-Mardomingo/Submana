import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages, inChunks, listAccessibleAccounts } from "@/lib/apiHelpers";
import { appNow, toDateString } from "@/lib/date";
import { assignMatches, priceAt, txDay, type MatchableSubscription, type MatchableTx } from "@/lib/subscriptionReconciliation";
import { learnedPattern, readSubscription, SUBSCRIPTION_SELECT } from "@/lib/subscriptionsServer";

/**
 * Automatic reconciliation of subscriptions (issue #108, phase 2): new expenses (manual, imported or
 * synced from the bank) and, once per subscription, the existing ones are matched with the scheduled
 * charges (lib/subscriptionReconciliation). High-confidence matches are linked; medium ones wait for the
 * user to confirm them (`subscription_review_id`). The summary feeds toasts and notifications.
 */

export interface PriceChangeFound {
  subscriptionId: string;
  serviceName: string;
  chargeDate: string;
  charged: number;
  saved: number;
}

export interface UnexpectedChargeFound {
  subscriptionId: string;
  serviceName: string;
  transactionId: string;
  accountId: string;
  /** YYYY-MM-DD the movement was booked. */
  txDate: string;
  chargeDate: string;
  amount: number;
  endDate: string | null;
}

export interface LinkFound {
  subscriptionId: string;
  serviceName: string;
  transactionId: string;
  chargeDate: string;
  amount: number;
}

export interface ReviewFound {
  subscriptionId: string;
  serviceName: string;
  transactionId: string;
  accountId: string;
  /** YYYY-MM-DD the movement was booked. */
  txDate: string;
  chargeDate: string;
  amount: number;
  description: string | null;
}

export interface ReconcileSummary {
  linked: number;
  review: number;
  links: LinkFound[];
  priceChanges: PriceChangeFound[];
  unexpected: UnexpectedChargeFound[];
  reviews: ReviewFound[];
}

export const emptySummary = (): ReconcileSummary => ({ linked: 0, review: 0, links: [], priceChanges: [], unexpected: [], reviews: [] });

const TX_COLUMNS = "id, type, amount, date, description, bank_description, account_id, subscription_dismissed_ids";
const cents = (n: number | string) => Math.round(Number(n) * 100);
/** Medium matches older than this are not worth asking about (the history would fill up with questions). */
const REVIEW_MAX_AGE_DAYS = 60;
const HISTORY_MONTHS = 24;

type Sub = MatchableSubscription & { cost: number | string };

async function loadSubscriptions(supabase: SupabaseClient, userId: string, subscriptionId?: string): Promise<Sub[]> {
  let query = supabase.from("subscriptions").select(SUBSCRIPTION_SELECT).eq("user_id", userId);
  if (subscriptionId) query = query.eq("id", subscriptionId);
  const { data } = await query;
  return (data ?? []) as Sub[];
}

/** Writes the chosen matches (links first; a row linked meanwhile is left alone) and learns bank texts. */
async function applyMatches(supabase: SupabaseClient, subs: Sub[], txs: MatchableTx[], opts: { reviewSince?: string; scope?: Set<string> } = {}) {
  const summary = emptySummary();
  const byId = new Map(subs.map((s) => [s.id, s]));
  const txById = new Map(txs.map((t) => [t.id, t]));
  const learned = new Set<string>();

  for (const match of assignMatches(subs, txs)) {
    if (opts.scope && !opts.scope.has(match.subscriptionId)) continue;
    const sub = byId.get(match.subscriptionId)!;
    const tx = txById.get(match.txId)!;
    if (match.kind === "unexpected") {
      summary.unexpected.push({ subscriptionId: sub.id, serviceName: sub.service_name, transactionId: tx.id, accountId: tx.account_id ?? "", txDate: txDay(tx), chargeDate: match.chargeDate, amount: Number(tx.amount), endDate: sub.end_date ?? null });
      continue;
    }
    if (match.kind === "review") {
      if (opts.reviewSince && txDay(tx) < opts.reviewSince) continue;
      const { data, error } = await supabase
        .from("transactions")
        .update({ subscription_review_id: sub.id, subscription_review_date: match.chargeDate })
        .eq("id", tx.id)
        .is("subscription_id", null)
        .select("id")
        .maybeSingle();
      if (error || !data) continue;
      summary.review++;
      summary.reviews.push({ subscriptionId: sub.id, serviceName: sub.service_name, transactionId: tx.id, accountId: tx.account_id ?? "", txDate: txDay(tx), chargeDate: match.chargeDate, amount: Number(tx.amount), description: tx.bank_description || tx.description || null });
      continue;
    }
    const { data, error } = await supabase
      .from("transactions")
      .update({ subscription_id: sub.id, subscription_charge_date: match.chargeDate, subscription_review_id: null, subscription_review_date: null })
      .eq("id", tx.id)
      .is("subscription_id", null)
      .select("id")
      .maybeSingle();
    if (error || !data) continue; // 23505: someone covered that charge meanwhile
    // Another row waiting to be this same charge no longer asks.
    await supabase
      .from("transactions")
      .update({ subscription_review_id: null, subscription_review_date: null })
      .eq("subscription_review_id", sub.id)
      .eq("subscription_review_date", match.chargeDate)
      .neq("id", tx.id);
    summary.linked++;
    summary.links.push({ subscriptionId: sub.id, serviceName: sub.service_name, transactionId: tx.id, chargeDate: match.chargeDate, amount: Number(tx.amount) });
    sub.charges = [...(sub.charges ?? []), { id: tx.id, amount: tx.amount, date: tx.date, subscription_charge_date: match.chargeDate }];
    const expected = priceAt(sub, match.chargeDate);
    if (cents(tx.amount) !== cents(expected)) {
      summary.priceChanges.push({ subscriptionId: sub.id, serviceName: sub.service_name, chargeDate: match.chargeDate, charged: Number(tx.amount), saved: expected });
    }
    if (!sub.match_pattern && !learned.has(sub.id)) {
      const pattern = learnedPattern(tx);
      if (pattern) {
        learned.add(sub.id);
        sub.match_pattern = pattern;
        await supabase.from("subscriptions").update({ match_pattern: pattern }).eq("id", sub.id).is("match_pattern", null);
      }
    }
  }
  return { summary, learned: learned.size > 0 };
}

const merge = (a: ReconcileSummary, b: ReconcileSummary): ReconcileSummary => ({
  linked: a.linked + b.linked,
  review: a.review + b.review,
  links: [...a.links, ...b.links],
  priceChanges: [...a.priceChanges, ...b.priceChanges],
  unexpected: [...a.unexpected, ...b.unexpected],
  reviews: [...a.reviews, ...b.reviews],
});

/**
 * Matches transactions that were just written (manual create, statement import, bank sync) with the
 * user's subscriptions. Works with the user's client or the service role (always filtered by user).
 */
export async function reconcileNewTransactions(supabase: SupabaseClient, userId: string, transactionIds: string[]): Promise<ReconcileSummary> {
  if (transactionIds.length === 0) return emptySummary();
  const subs = await loadSubscriptions(supabase, userId);
  if (subs.length === 0) return emptySummary();
  const rows = await inChunks(transactionIds, 200, (chunk) =>
    supabase.from("transactions").select(TX_COLUMNS).in("id", chunk).eq("type", "expense").is("subscription_id", null)
  );
  if (rows.length === 0) return emptySummary();
  return (await applyMatches(supabase, subs, rows as MatchableTx[])).summary;
}

/**
 * Looks for the charges of the user's subscriptions (or one of them) among the expenses of the last 24
 * months not linked yet. Medium matches only ask about the last 60 days. A second pass uses the bank
 * texts learned in the first. Marks the subscriptions as reconciled.
 */
export async function reconcileHistory(supabase: SupabaseClient, userId: string, opts: { subscriptionId?: string; onlyNew?: boolean } = {}): Promise<ReconcileSummary> {
  let subs = await loadSubscriptions(supabase, userId, opts.subscriptionId);
  if (opts.onlyNew) subs = subs.filter((s) => !(s as { auto_reconciled_at?: string | null }).auto_reconciled_at);
  if (subs.length === 0) return emptySummary();

  const { ids } = await listAccessibleAccounts(supabase, userId);
  const accounts = [...new Set(subs.some((s) => !s.account_id) ? ids : subs.map((s) => s.account_id!).filter((a) => ids.includes(a)))];
  const scope = new Set(subs.map((s) => s.id));
  const markDone = () => supabase.from("subscriptions").update({ auto_reconciled_at: new Date().toISOString() }).eq("user_id", userId).in("id", [...scope]);
  if (accounts.length === 0) {
    await markDone();
    return emptySummary();
  }

  const today = appNow();
  const since = new Date(today.getFullYear(), today.getMonth() - HISTORY_MONTHS, today.getDate(), 12);
  const reviewSince = toDateString(new Date(today.getFullYear(), today.getMonth(), today.getDate() - REVIEW_MAX_AGE_DAYS, 12));
  const rows = await fetchAllPages((from, to) =>
    supabase
      .from("transactions")
      .select(TX_COLUMNS)
      .in("account_id", accounts)
      .eq("type", "expense")
      .is("subscription_id", null)
      .gte("date", since.toISOString())
      .order("id")
      .range(from, to)
  );

  // Matching runs against every subscription, so a transaction goes to the one it fits best; only the
  // matches of the subscriptions in scope are written.
  const allSubs = opts.subscriptionId || opts.onlyNew ? await loadSubscriptions(supabase, userId) : subs;

  let txs = rows as MatchableTx[];
  const first = await applyMatches(supabase, allSubs, txs, { reviewSince, scope });
  let summary = first.summary;
  if (first.learned) {
    const linkedIds = new Set<string>();
    for (const s of allSubs) for (const c of s.charges ?? []) linkedIds.add(c.id);
    txs = txs.filter((t) => !linkedIds.has(t.id));
    summary = merge(summary, (await applyMatches(supabase, allSubs, txs, { reviewSince, scope })).summary);
  }
  await markDone();
  return summary;
}

/** What the sheet is told about the transaction it just created (one transaction: at most one match). */
export interface ManualMatchInfo {
  kind: "link" | "review" | "unexpected";
  subscription_id: string;
  service_name: string;
  charge_date: string;
  /** Link only: the price saved for that charge, when the amount differs from it. */
  expected?: number;
}

export interface ManualMatch {
  row: Record<string, string>;
  info: ManualMatchInfo;
}

export function manualMatch(summary: ReconcileSummary): ManualMatch | null {
  const review = summary.reviews[0];
  if (review) {
    return {
      row: { subscription_review_id: review.subscriptionId, subscription_review_date: review.chargeDate },
      info: { kind: "review", subscription_id: review.subscriptionId, service_name: review.serviceName, charge_date: review.chargeDate },
    };
  }
  const unexpected = summary.unexpected[0];
  if (unexpected) {
    return { row: {}, info: { kind: "unexpected", subscription_id: unexpected.subscriptionId, service_name: unexpected.serviceName, charge_date: unexpected.chargeDate } };
  }
  const link = summary.links[0];
  if (!link) return null;
  const change = summary.priceChanges.find((p) => p.subscriptionId === link.subscriptionId);
  return {
    row: { subscription_id: link.subscriptionId, subscription_charge_date: link.chargeDate },
    info: { kind: "link", subscription_id: link.subscriptionId, service_name: link.serviceName, charge_date: link.chargeDate, ...(change && { expected: change.saved }) },
  };
}

/** What reconciling one subscription found, attached to it for the client (`reconciled`). */
export async function reconcileSubscription(supabase: SupabaseClient, userId: string, subscriptionId: string) {
  let found = emptySummary();
  try {
    found = await reconcileHistory(supabase, userId, { subscriptionId });
  } catch (error) {
    console.error("[subscriptions] reconcile history", error);
  }
  const sub = await readSubscription(supabase, userId, subscriptionId);
  return sub ? { ...sub, reconciled: { linked: found.linked, review: found.review } } : null;
}
