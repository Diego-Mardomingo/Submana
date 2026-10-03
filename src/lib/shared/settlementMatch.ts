import { descriptionTokens } from "@/lib/dedup/normalizeDescription";
import { toCents } from "./splits";

export const SETTLEMENT_WINDOW_DAYS = 60;

export interface SettlementTx {
  id: string;
  type: string;
  amount: number | string;
  date: string;
  description?: string | null;
}

/** A person-in-a-group balance: `cents` > 0 means the friend owes me, < 0 means I owe them. */
export interface OwedPair {
  groupId: string;
  friendId: string;
  displayName: string;
  handle: string;
  cents: number;
}

export interface SettlementSuggestion {
  txId: string;
  groupId: string;
  friendId: string;
  /** from_friend: an income that settles what the friend owes me; to_friend: an expense that pays what I owe. */
  direction: "from_friend" | "to_friend";
  amountCents: number;
  exact: boolean;
  score: number;
}

const MIN_SCORE = 0.5;

function nameScore(descTokens: string[], pair: OwedPair) {
  const names = new Set([...descriptionTokens(pair.displayName), ...descriptionTokens(pair.handle.replace(/_/g, " "))]);
  if (names.size === 0 || descTokens.length === 0) return 0;
  let hits = 0;
  for (const name of names) {
    const hit = descTokens.some(
      (t) => t === name || (t.length >= 4 && name.length >= 4 && (t.startsWith(name) || name.startsWith(t)))
    );
    if (hit) hits += 1;
  }
  return hits / names.size;
}

/**
 * Suggests which transactions settle a debt: an income matches a friend who owes me, an expense a
 * friend I owe. Exact cents score high, a partial payment (less than the debt) lower, and the
 * friend's name or handle in the description adds to it. Each transaction and each pair is used once.
 */
export function suggestSettlements(
  transactions: SettlementTx[],
  pairs: OwedPair[],
  now: Date = new Date()
): SettlementSuggestion[] {
  const windowMs = SETTLEMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const candidates: SettlementSuggestion[] = [];

  for (const tx of transactions) {
    const ts = new Date(tx.date).getTime();
    if (!Number.isFinite(ts) || now.getTime() - ts > windowMs || ts - now.getTime() > 24 * 60 * 60 * 1000) continue;
    const cents = toCents(tx.amount);
    if (cents <= 0 || (tx.type !== "income" && tx.type !== "expense")) continue;
    const wantsPositive = tx.type === "income";
    const tokens = descriptionTokens(tx.description);

    for (const pair of pairs) {
      if (wantsPositive ? pair.cents <= 0 : pair.cents >= 0) continue;
      const owed = Math.abs(pair.cents);
      if (cents > owed) continue;
      const exact = cents === owed;
      const score = (exact ? 0.6 : 0.36) + 0.4 * nameScore(tokens, pair);
      if (score < MIN_SCORE) continue;
      candidates.push({
        txId: tx.id,
        groupId: pair.groupId,
        friendId: pair.friendId,
        direction: wantsPositive ? "from_friend" : "to_friend",
        amountCents: cents,
        exact,
        score: Math.round(score * 1000) / 1000,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score || (a.txId < b.txId ? -1 : 1));
  const usedTx = new Set<string>();
  const usedPair = new Set<string>();
  return candidates.filter((c) => {
    const pairKey = `${c.groupId}:${c.friendId}`;
    if (usedTx.has(c.txId) || usedPair.has(pairKey)) return false;
    usedTx.add(c.txId);
    usedPair.add(pairKey);
    return true;
  });
}
