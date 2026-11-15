import { appNow, calendarDayInAppTimeZone, toDateString } from "@/lib/date";
import { descriptionScore } from "@/lib/dedup/matchScore";
import { descriptionTokens } from "@/lib/dedup/normalizeDescription";
import { chargeDatesBetween, isSubscriptionActive, nextPaymentDate } from "@/lib/subscriptions";
import type { Subscription } from "@/hooks/useSubscriptions";

/**
 * Subscriptions reconciled with transactions (issue #108): each charge date of a subscription can be
 * covered by one transaction (`transactions.subscription_id` + `subscription_charge_date`). From that,
 * every charge gets a status, the price history says what was expected on each date, and the total
 * spent is what was really charged. Pure functions: "today" is the Madrid day unless given.
 */

/** Days after a charge date during which a missing transaction is still "pending" (banks charge late). */
export const GRACE_DAYS = 3;
/** Days around a charge date in which transactions are offered to link it by hand. */
export const PICK_WINDOW_DAYS = 15;

export interface PriceStep {
  cost: number | string;
  /** YYYY-MM-DD */
  valid_from: string;
  source?: "manual" | "detected";
}

/** A transaction waiting for the user to confirm it is a charge (`subscription_review_id`). */
export interface ReviewCharge {
  id: string;
  amount: number | string;
  date: string;
  /** YYYY-MM-DD of the expected charge it may cover. */
  subscription_review_date: string;
  description?: string | null;
  bank_description?: string | null;
}

/** A transaction linked to a subscription (only what reconciliation needs). */
export interface LinkedCharge {
  id: string;
  amount: number | string;
  /** The transaction's own instant (timestamptz). */
  date: string;
  /** YYYY-MM-DD of the expected charge it covers. */
  subscription_charge_date: string;
  description?: string | null;
  bank_description?: string | null;
}

export type ReconcilableSubscription = Pick<
  Subscription,
  "start_date" | "end_date" | "frequency" | "frequency_value" | "cost" | "skipped_charges" | "dismissed_price_charge" | "price_history" | "charges"
> & { reviews?: ReviewCharge[] | null };

export type ChargeStatus =
  /** Linked, for the price in force that day. */
  | "paid"
  /** Linked, for another amount. */
  | "changed"
  /** No transaction yet, within the grace window. */
  | "pending"
  /** No transaction and the grace window is over (only once the subscription is being tracked). */
  | "missed"
  /** The user said it wasn't charged. */
  | "skipped"
  /** Before the first linked charge: nothing to check it against. */
  | "unverified"
  /** A transaction may be this charge: the user confirms it or not. */
  | "review"
  /** The next charge. */
  | "upcoming";

export interface Charge {
  /** YYYY-MM-DD of the expected charge. */
  date: string;
  status: ChargeStatus;
  /** Price in force that day. */
  expected: number;
  /** The linked transaction, if any. */
  tx?: LinkedCharge;
  /** The transaction waiting to be confirmed as this charge ("review"). */
  review?: ReviewCharge;
  /** What was charged (linked) or is expected. */
  amount: number;
  /** amount - expected, for "changed". */
  diff?: number;
  /** Day the money really moved, when it differs from `date`. */
  bookedOn?: string;
}

const cents = (value: number | string) => Math.round(Number(value) * 100);
const euros = (c: number) => c / 100;
const DAY_MS = 86_400_000;
const dayIndex = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
};
/** b - a in calendar days (YYYY-MM-DD strings). */
export const daysBetween = (a: string, b: string) => dayIndex(b) - dayIndex(a);
const addDays = (iso: string, days: number) => new Date((dayIndex(iso) + days) * DAY_MS).toISOString().slice(0, 10);
const noonOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};
const todayIso = (today?: Date) => toDateString(today ?? appNow());
/** Madrid day of a transaction instant. */
export const txDay = (tx: Pick<LinkedCharge, "date">) => calendarDayInAppTimeZone(tx.date);

/** The price in force on `day`: the last step that started on or before it (before the first one, the first one). */
export function priceAt(sub: Pick<ReconcilableSubscription, "cost" | "price_history">, day: string): number {
  const steps = [...(sub.price_history ?? [])].sort((a, b) => a.valid_from.localeCompare(b.valid_from));
  if (steps.length === 0) return Number(sub.cost);
  let price = Number(steps[0].cost);
  for (const step of steps) if (step.valid_from <= day) price = Number(step.cost);
  return price;
}

/**
 * Every charge of the subscription up to today, newest first, plus the next one at the top. Linked
 * transactions whose charge date is not in the schedule (it changed later) are kept as their own rows.
 */
export function chargeHistory(sub: ReconcilableSubscription, today?: Date): Charge[] {
  const todayStr = todayIso(today);
  const linked = new Map((sub.charges ?? []).map((tx) => [tx.subscription_charge_date, tx]));
  const firstLinked = [...linked.keys()].sort()[0] ?? null;
  const skipped = new Set(sub.skipped_charges ?? []);
  const reviews = new Map((sub.reviews ?? []).map((tx) => [tx.subscription_review_date, tx]));

  const fromLinked = (date: string, tx: LinkedCharge): Charge => {
    const expected = priceAt(sub, date);
    const diff = cents(tx.amount) - cents(expected);
    const booked = txDay(tx);
    return { date, status: diff === 0 ? "paid" : "changed", expected, tx, amount: Number(tx.amount), ...(diff !== 0 && { diff: euros(diff) }), ...(booked !== date && { bookedOn: booked }) };
  };

  const charges: Charge[] = [];
  const scheduled = chargeDatesBetween(sub, noonOf(sub.start_date), noonOf(todayStr)).map(toDateString);
  for (const date of scheduled) {
    const tx = linked.get(date);
    if (tx) {
      charges.push(fromLinked(date, tx));
      linked.delete(date);
      continue;
    }
    const expected = priceAt(sub, date);
    const review = reviews.get(date);
    if (review && !skipped.has(date)) {
      charges.push({ date, status: "review", expected, review, amount: Number(review.amount) });
      continue;
    }
    const status: ChargeStatus = skipped.has(date)
      ? "skipped"
      : daysBetween(date, todayStr) <= GRACE_DAYS
        ? "pending"
        : firstLinked && date >= firstLinked
          ? "missed"
          : "unverified";
    charges.push({ date, status, expected, amount: expected });
  }
  for (const [date, tx] of linked) charges.push(fromLinked(date, tx));
  charges.sort((a, b) => b.date.localeCompare(a.date));

  const next = nextPaymentDate(sub, noonOf(todayStr));
  if (next) {
    const date = toDateString(next);
    if (!charges.some((c) => c.date === date)) {
      const expected = priceAt(sub, date);
      charges.unshift({ date, status: "upcoming", expected, amount: expected });
    }
  }
  return charges;
}

/** The most recent charge that is already due (not the upcoming one). */
export function lastCharge(sub: ReconcilableSubscription, today?: Date): Charge | null {
  return chargeHistory(sub, today).find((c) => c.status !== "upcoming") ?? null;
}

export interface PriceChange {
  /** YYYY-MM-DD of the charge that came with the new amount. */
  chargeDate: string;
  charged: number;
  /** What the subscription has saved now. */
  saved: number;
  diff: number;
}

/**
 * The latest linked charge came for an amount other than the saved price and the user hasn't decided
 * yet (updating the price, or ignoring it for that charge).
 */
export function pendingPriceChange(sub: ReconcilableSubscription, today?: Date): PriceChange | null {
  const latest = chargeHistory(sub, today).find((c) => c.tx);
  if (!latest?.tx || latest.status !== "changed") return null;
  if (sub.dismissed_price_charge && latest.date <= sub.dismissed_price_charge) return null;
  const charged = Number(latest.tx.amount);
  const saved = Number(sub.cost);
  if (cents(charged) === cents(saved)) return null;
  return { chargeDate: latest.date, charged, saved, diff: euros(cents(charged) - cents(saved)) };
}

export type ListStatus =
  | { kind: "price"; charged: number }
  | { kind: "missed"; date: string }
  | { kind: "review"; date: string }
  | { kind: "pending"; date: string }
  | { kind: "skipped"; date: string }
  | { kind: "paid"; date: string };

/** What the subscriptions list says about a subscription's last charge; null keeps the frequency. */
export function listStatus(sub: ReconcilableSubscription, today?: Date): ListStatus | null {
  if (!isSubscriptionActive(sub, today)) return null;
  const change = pendingPriceChange(sub, today);
  if (change) return { kind: "price", charged: change.charged };
  const last = lastCharge(sub, today);
  if (!last) return null;
  switch (last.status) {
    case "missed":
    case "review":
    case "pending":
    case "skipped":
      return { kind: last.status, date: last.date };
    case "paid":
    case "changed":
      return { kind: "paid", date: last.date };
    default:
      return null;
  }
}

/**
 * Money that left for the subscription up to today: the linked transactions as charged, the charges
 * nobody could check at the price of their day, and nothing for charges marked as not charged or missing.
 */
export function reconciledTotal(sub: ReconcilableSubscription, today?: Date) {
  let total = 0;
  let linked = 0;
  let estimated = 0;
  for (const charge of chargeHistory(sub, today)) {
    if (charge.status === "upcoming" || charge.status === "missed" || charge.status === "skipped") continue;
    total += cents(charge.amount);
    if (charge.tx) linked++;
    else estimated++;
  }
  return { total: euros(total), linked, estimated };
}

/** The scheduled charge closest to a transaction day (within the pick window), or null. */
export function chargeDateFor(sub: ReconcilableSubscription, day: string): string | null {
  const dates = chargeDatesBetween(sub, noonOf(addDays(day, -PICK_WINDOW_DAYS)), noonOf(addDays(day, PICK_WINDOW_DAYS))).map(toDateString);
  let best: string | null = null;
  for (const date of dates) {
    const distance = Math.abs(daysBetween(date, day));
    if (best === null || distance < Math.abs(daysBetween(best, day))) best = date;
  }
  return best;
}

export interface CandidateTx {
  id: string;
  amount: number | string;
  date: string;
  type: string;
  description?: string | null;
  bank_description?: string | null;
}

export type CandidateReason = "strong" | "amount" | "date" | "name";

/**
 * How well a transaction fits the charge of `chargeDate`, 0–1, and the main reason to offer it.
 * Date closeness 25 %, amount 30 % (same cents 1, within ±10 % or ±1.50 € 0.6), description 45 %
 * (against the learned bank text, or else the service name).
 */
export function scoreCandidate(
  sub: Pick<ReconcilableSubscription, "cost" | "price_history"> & { service_name: string; match_pattern?: string | null },
  tx: CandidateTx,
  chargeDate: string
): { score: number; reason: CandidateReason | null } {
  const expected = priceAt(sub, chargeDate);
  const delta = Math.abs(daysBetween(chargeDate, txDay(tx)));
  const dateScore = Math.max(0, 1 - delta / PICK_WINDOW_DAYS);
  const diff = Math.abs(cents(tx.amount) - cents(expected));
  const amountScore = diff === 0 ? 1 : diff <= Math.max(150, cents(expected) * 0.1) ? 0.6 : Math.max(0, 0.3 * (1 - diff / Math.max(1, cents(expected))));
  const txTokens = descriptionTokens(tx.bank_description || tx.description);
  const pattern = descriptionTokens(sub.match_pattern);
  const nameScore = descriptionScore(txTokens, pattern.length ? pattern : descriptionTokens(sub.service_name));
  const score = 0.25 * dateScore + 0.3 * amountScore + 0.45 * nameScore;
  const reason: CandidateReason | null =
    score >= 0.8 ? "strong" : amountScore >= 0.6 ? "amount" : nameScore >= 0.5 ? "name" : dateScore >= 0.8 ? "date" : null;
  return { score, reason };
}

/* ── Automatic matching (phase 2) ── */

/** At or above: the transaction is linked on its own. */
export const AUTO_LINK_SCORE = 0.8;
/** At or above (and below AUTO_LINK_SCORE): it waits for the user to confirm it. */
export const REVIEW_SCORE = 0.55;

export type MatchableSubscription = ReconcilableSubscription & {
  id: string;
  service_name: string;
  account_id?: string | null;
  match_pattern?: string | null;
};

export interface MatchableTx extends CandidateTx {
  account_id?: string | null;
  /** Subscriptions the user said this transaction is not a charge of. */
  subscription_dismissed_ids?: string[] | null;
}

export interface Match {
  subscriptionId: string;
  txId: string;
  chargeDate: string;
  score: number;
  /** link: high confidence; review: ask the user; unexpected: fits a subscription that already ended (never linked). */
  kind: "link" | "review" | "unexpected";
}

const scheduleNear = (sub: MatchableSubscription, day: string, ignoreEnd: boolean) =>
  chargeDatesBetween({ ...sub, ...(ignoreEnd && { end_date: null }) }, noonOf(addDays(day, -GRACE_DAYS)), noonOf(addDays(day, GRACE_DAYS))).map(toDateString);

/**
 * Every way a new expense could be a charge: same account as the subscription (when it has one), the
 * transaction within ±3 days of a scheduled charge nobody covers yet (not skipped), and some evidence
 * in the description (or the exact amount within a day). A charge of a subscription that already ended
 * comes back as "unexpected" when it is a strong match.
 */
export function matchOptions(subs: MatchableSubscription[], tx: MatchableTx): Match[] {
  if (tx.type !== "expense") return [];
  const day = txDay(tx);
  const dismissed = new Set(tx.subscription_dismissed_ids ?? []);
  const out: Match[] = [];
  for (const sub of subs) {
    if (dismissed.has(sub.id)) continue;
    if (sub.account_id && tx.account_id && sub.account_id !== tx.account_id) continue;
    const ended = !!sub.end_date && sub.end_date < day;
    const taken = new Set((sub.charges ?? []).map((c) => c.subscription_charge_date));
    const skipped = new Set(sub.skipped_charges ?? []);
    for (const chargeDate of scheduleNear(sub, day, ended)) {
      if (taken.has(chargeDate) || skipped.has(chargeDate)) continue;
      const { score, nameScore, amountExact } = matchScore(sub, tx, chargeDate);
      const evidence = nameScore >= 0.5 || (amountExact && Math.abs(daysBetween(chargeDate, day)) <= 1);
      if (!evidence) continue;
      if (ended) {
        if (score >= AUTO_LINK_SCORE) out.push({ subscriptionId: sub.id, txId: tx.id, chargeDate, score, kind: "unexpected" });
        continue;
      }
      if (score >= REVIEW_SCORE) out.push({ subscriptionId: sub.id, txId: tx.id, chargeDate, score, kind: score >= AUTO_LINK_SCORE ? "link" : "review" });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

/** The single best match of one transaction, or null. */
export function bestMatch(subs: MatchableSubscription[], tx: MatchableTx): Match | null {
  return matchOptions(subs, tx)[0] ?? null;
}

/**
 * Matches for a batch of transactions: best scores first, each transaction and each charge used once
 * (a charge with a link no longer takes reviews).
 */
export function assignMatches(subs: MatchableSubscription[], txs: MatchableTx[]): Match[] {
  const options = txs.flatMap((tx) => matchOptions(subs, tx)).sort((a, b) => b.score - a.score);
  const usedTx = new Set<string>();
  const usedCharge = new Set<string>();
  const chosen: Match[] = [];
  for (const option of options) {
    const charge = `${option.subscriptionId}|${option.chargeDate}`;
    if (usedTx.has(option.txId) || (option.kind !== "unexpected" && usedCharge.has(charge))) continue;
    usedTx.add(option.txId);
    if (option.kind !== "unexpected") usedCharge.add(charge);
    chosen.push(option);
  }
  return chosen;
}

/** scoreCandidate restricted to the ±3-day matching window, with the pieces the gates need. */
function matchScore(sub: MatchableSubscription, tx: CandidateTx, chargeDate: string) {
  const expected = priceAt(sub, chargeDate);
  const delta = Math.abs(daysBetween(chargeDate, txDay(tx)));
  const dateScore = delta === 0 ? 1 : delta === 1 ? 0.9 : delta === 2 ? 0.8 : 0.65;
  const diff = Math.abs(cents(tx.amount) - cents(expected));
  const amountExact = diff === 0;
  const amountScore = amountExact ? 1 : diff <= Math.max(150, cents(expected) * 0.1) ? 0.6 : 0;
  const txTokens = descriptionTokens(tx.bank_description || tx.description);
  const pattern = descriptionTokens(sub.match_pattern);
  const nameScore = descriptionScore(txTokens, pattern.length ? pattern : descriptionTokens(sub.service_name));
  return { score: 0.25 * dateScore + 0.3 * amountScore + 0.45 * nameScore, nameScore, amountExact };
}

/* ── Home calendar (phase 3) ── */

export interface DayCharge {
  /** Day of the month (1-31) where it shows: the day the money moved when there is a movement (linked or to confirm), else the charge date. */
  day: number;
  /** The charge with its real status; future payment days come as "upcoming". */
  charge: Charge;
}

/**
 * The charges of a subscription that fall in a month (1-12), for the Home calendar. Past and today's
 * come from chargeHistory with their real status; a charge with a movement (linked or to confirm) shows on
 * the day it was booked (a late charge is not drawn twice). Payment days after today are "upcoming".
 */
export function monthCharges(sub: ReconcilableSubscription, year: number, month: number, today?: Date): DayCharge[] {
  const todayStr = todayIso(today);
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const out: DayCharge[] = [];
  const shownDates = new Set<string>();
  for (const charge of chargeHistory(sub, today)) {
    if (charge.status === "upcoming") continue;
    const moved = charge.tx ?? charge.review;
    const where = moved ? txDay(moved) : charge.date;
    shownDates.add(charge.date);
    if (where.startsWith(prefix)) out.push({ day: Number(where.slice(8, 10)), charge });
  }
  const first = `${prefix}01`;
  const last = toDateString(new Date(year, month, 0, 12));
  const from = todayStr >= first ? addDays(todayStr, 1) : first;
  if (from <= last) {
    for (const date of chargeDatesBetween(sub, noonOf(from), noonOf(last)).map(toDateString)) {
      if (shownDates.has(date)) continue;
      const expected = priceAt(sub, date);
      out.push({ day: Number(date.slice(8, 10)), charge: { date, status: "upcoming", expected, amount: expected } });
    }
  }
  return out.sort((a, b) => a.day - b.day);
}

/** A charge that should have arrived and did not, for the missed-charge notification (cron). */
export interface MissedCharge {
  date: string;
  expected: number;
}

/**
 * Charges that just became "missed" (no transaction once the grace window is over), at most
 * `lookbackDays` old so the first run does not flood the inbox with the past. Newest first.
 */
export function recentMissedCharges(sub: ReconcilableSubscription, today?: Date, lookbackDays = 7): MissedCharge[] {
  const todayStr = todayIso(today);
  return chargeHistory(sub, today)
    .filter((c) => c.status === "missed" && daysBetween(c.date, todayStr) <= GRACE_DAYS + lookbackDays)
    .map((c) => ({ date: c.date, expected: c.expected }));
}
