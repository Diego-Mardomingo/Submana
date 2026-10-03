export type SplitMode = "equal" | "exact" | "percent" | "shares";

export const SPLIT_MODES: readonly SplitMode[] = ["equal", "exact", "percent", "shares"];

export interface SplitParticipant {
  userId: string;
  /** exact: cents; percent: percentage (0-100); shares: weight. Ignored for equal. */
  value?: number;
}

export interface ComputedShare {
  userId: string;
  cents: number;
  /** percent / shares input (kept to re-open the editor); null for equal and exact. */
  weight: number | null;
}

export type SplitError = "invalid_total" | "no_participants" | "invalid_value" | "sum_mismatch";

export type SplitResult =
  | { ok: true; shares: ComputedShare[] }
  | { ok: false; error: SplitError; /** exact mode: total - sum, in cents */ remainingCents?: number };

/** Payer first (absorbs the leftover cents), then by id: the outcome never depends on input order. */
function order(participants: SplitParticipant[], payerId: string | null) {
  return [...participants].sort((a, b) => {
    if (a.userId === payerId) return -1;
    if (b.userId === payerId) return 1;
    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
  });
}

/** Largest-remainder allocation of `total` cents proportionally to `weights` (same order). */
function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const quotas = weights.map((w) => (total * w) / sum);
  const cents = quotas.map((q) => Math.floor(q + 1e-9));
  let left = total - cents.reduce((a, b) => a + b, 0);
  const byRemainder = quotas
    .map((q, i) => ({ i, rem: q - cents[i]!, eligible: weights[i]! > 0 }))
    .filter((x) => x.eligible)
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (let k = 0; left > 0 && byRemainder.length > 0; k++, left--) cents[byRemainder[k % byRemainder.length]!.i]! += 1;
  return cents;
}

/**
 * Splits `totalCents` among the participants. The result always sums to the total, except in exact
 * mode where a mismatch is reported (`sum_mismatch`). Remainder cents go to the payer first.
 */
export function computeShares(
  totalCents: number,
  mode: SplitMode,
  participants: SplitParticipant[],
  payerId: string | null = null
): SplitResult {
  if (!Number.isInteger(totalCents) || totalCents <= 0) return { ok: false, error: "invalid_total" };
  const unique = new Map(participants.map((p) => [p.userId, p]));
  if (unique.size === 0) return { ok: false, error: "no_participants" };
  const ordered = order([...unique.values()], payerId);

  if (mode === "equal") {
    const cents = allocate(totalCents, ordered.map(() => 1));
    return { ok: true, shares: ordered.map((p, i) => ({ userId: p.userId, cents: cents[i]!, weight: null })) };
  }

  const values = ordered.map((p) => p.value ?? 0);
  if (values.some((v) => !Number.isFinite(v) || v < 0)) return { ok: false, error: "invalid_value" };

  if (mode === "exact") {
    if (values.some((v) => !Number.isInteger(v))) return { ok: false, error: "invalid_value" };
    const sum = values.reduce((a, b) => a + b, 0);
    if (sum !== totalCents) return { ok: false, error: "sum_mismatch", remainingCents: totalCents - sum };
    return { ok: true, shares: ordered.map((p, i) => ({ userId: p.userId, cents: values[i]!, weight: null })) };
  }

  // percent / shares: proportional to the values (percentages that do not add up to 100 are normalised).
  if (values.every((v) => v === 0)) return { ok: false, error: "invalid_value" };
  const cents = allocate(totalCents, values);
  return { ok: true, shares: ordered.map((p, i) => ({ userId: p.userId, cents: cents[i]!, weight: values[i]! })) };
}

/** Euros (number or numeric string) to integer cents. */
export function toCents(amount: number | string): number {
  return Math.round((Number(amount) || 0) * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}
