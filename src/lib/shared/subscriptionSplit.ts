import { computeShares, SPLIT_MODES, toCents, type ComputedShare, type SplitMode } from "./splits";

/**
 * How a shared subscription divides each charge in its Subcount group (`subscriptions.shared_split`):
 * the same modes as a group expense. `value`: exact = euros, percent = %, shares = weight; none for equal.
 */
export interface SharedSplit {
  mode: SplitMode;
  participants: { user_id: string; value?: number }[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A valid split from untrusted input (the API body or the stored jsonb), or null. */
export function parseSharedSplit(raw: unknown): SharedSplit | null {
  if (!raw || typeof raw !== "object") return null;
  const { mode, participants } = raw as { mode?: unknown; participants?: unknown };
  if (!SPLIT_MODES.includes(mode as SplitMode) || !Array.isArray(participants)) return null;
  if (participants.length === 0 || participants.length > 31) return null;
  const seen = new Set<string>();
  const out: SharedSplit["participants"] = [];
  for (const p of participants) {
    const { user_id, value } = (p ?? {}) as { user_id?: unknown; value?: unknown };
    if (typeof user_id !== "string" || !UUID.test(user_id) || seen.has(user_id)) return null;
    seen.add(user_id);
    if (mode === "equal") {
      out.push({ user_id });
      continue;
    }
    const n = Number(value);
    if (value == null || !Number.isFinite(n) || n < 0 || n > 1_000_000) return null;
    out.push({ user_id, value: n });
  }
  return { mode: mode as SplitMode, participants: out };
}

/**
 * The shares of one charge. Only current group members take part (someone who left is dropped and the
 * rest share it); if nobody is left, the whole group splits it equally. Exact amounts that no longer
 * add up to the charge (the price changed) are scaled proportionally, so a charge always splits.
 */
export function subscriptionShares(split: SharedSplit, memberIds: readonly string[], totalCents: number, payerId: string): ComputedShare[] | null {
  if (!Number.isInteger(totalCents) || totalCents <= 0) return null;
  const members = new Set(memberIds);
  const kept = split.participants.filter((p) => members.has(p.user_id));
  const participants: SharedSplit["participants"] = kept.length > 0 ? kept : memberIds.map((user_id) => ({ user_id }));
  const mode: SplitMode = kept.length > 0 ? split.mode : "equal";
  if (participants.length === 0) return null;

  const asInput = (m: SplitMode) =>
    participants.map((p) => ({ userId: p.user_id, value: p.value === undefined ? undefined : m === "exact" ? toCents(p.value) : p.value }));
  let result = computeShares(totalCents, mode, asInput(mode), payerId);
  if (!result.ok && mode === "exact") {
    // Same proportions as the exact amounts; still recorded as exact amounts.
    const scaled = computeShares(totalCents, "shares", asInput("exact"), payerId);
    result = scaled.ok ? { ok: true, shares: scaled.shares.map((s) => ({ ...s, weight: null })) } : scaled;
  }
  if (!result.ok && mode !== "equal") result = computeShares(totalCents, "equal", asInput("equal"), payerId);
  return result.ok ? result.shares : null;
}

/** My part of one charge in cents (0 if I don't take part), for the sheet and the list. */
export function myShareCents(split: SharedSplit, memberIds: readonly string[], totalCents: number, payerId: string, meId: string) {
  return subscriptionShares(split, memberIds, totalCents, payerId)?.find((s) => s.userId === meId)?.cents ?? 0;
}
