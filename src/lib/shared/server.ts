import type { SupabaseClient } from "@supabase/supabase-js";
import { jsonError, jsonServerError } from "@/lib/apiHelpers";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { simplifyDebts } from "./debts";
import type { OwedPair } from "./settlementMatch";
import type { SharedProfile } from "./types";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres exceptions raised by the shared-expense RPCs and the HTTP status they map to. */
const RPC_STATUS: Record<string, number> = {
  not_authenticated: 401,
  not_a_member: 403,
  not_payer: 403,
  group_not_found: 404,
  expense_not_found: 404,
  transaction_not_found: 404,
  member_not_found: 404,
  profile_required: 409,
  group_archived: 409,
  member_has_balance: 409,
  transaction_already_linked: 409,
  settlement_already_linked: 409,
  shared_tx_managed: 409,
  not_friends: 400,
  direct_group: 400,
  too_many_members: 400,
  invalid_name: 400,
  invalid_title: 400,
  invalid_total: 400,
  invalid_split_mode: 400,
  invalid_shares: 400,
  invalid_category: 400,
  invalid_settlement: 400,
  invalid_transaction: 400,
  invalid_payer_transaction: 400,
  not_an_expense: 400,
  share_user_not_member: 400,
  payer_not_member: 400,
  sum_mismatch: 400,
};

/** Maps a known RPC exception to its status; anything else is a logged 500. */
export function rpcErrorResponse(context: string, error: { message: string }) {
  const status = RPC_STATUS[error.message];
  return status ? jsonError(error.message, status) : jsonServerError(context, error);
}

/** Rate limit shared by every write under /api/shared. */
export function limitSharedWrites(userId: string) {
  return enforceRateLimit(`shared:${userId}`, RATE_LIMITS.shared.limit, RATE_LIMITS.shared.windowSeconds);
}

export async function fetchProfiles(supabase: SupabaseClient, ids: string[]): Promise<Map<string, SharedProfile>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("user_id, handle, display_name, avatar_url").in("user_id", unique);
  return new Map((data ?? []).map((p) => [p.user_id as string, p as SharedProfile]));
}

/** Net balance (cents) of every member of each of my groups, from one RPC call. */
export async function loadGroupNets(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("my_group_balances");
  if (error) throw error;
  const byGroup = new Map<string, Record<string, number>>();
  for (const row of (data ?? []) as { group_id: string; user_id: string; net: number | string }[]) {
    const nets = byGroup.get(row.group_id) ?? {};
    nets[row.user_id] = Math.round(Number(row.net) * 100);
    byGroup.set(row.group_id, nets);
  }
  return byGroup;
}

/**
 * My position against each person in each group, from the simplified transfers (who pays whom)
 * that involve me. Positive cents: they owe me.
 */
export async function loadOwedPairs(supabase: SupabaseClient, me: string) {
  const nets = await loadGroupNets(supabase);
  const raw: { groupId: string; friendId: string; cents: number }[] = [];
  for (const [groupId, groupNets] of nets) {
    for (const t of simplifyDebts(groupNets)) {
      if (t.to === me) raw.push({ groupId, friendId: t.from, cents: t.cents });
      else if (t.from === me) raw.push({ groupId, friendId: t.to, cents: -t.cents });
    }
  }
  const profiles = await fetchProfiles(supabase, raw.map((r) => r.friendId));
  const pairs: OwedPair[] = raw.flatMap((r) => {
    const profile = profiles.get(r.friendId);
    return profile ? [{ ...r, displayName: profile.display_name, handle: profile.handle }] : [];
  });
  return { pairs, nets, profiles };
}

/**
 * Before bulk-deleting bank rows (account or month range), unlink the ones tied to shared expenses
 * so every payer keeps their invariant (a payer whose bank row disappears gets a virtual row).
 */
export async function unlinkLinkedTransactions(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  range?: { startIso: string; endExclusiveIso: string }
) {
  let query = supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .not("shared_expense_id", "is", null);
  if (range) query = query.gte("date", range.startIso).lt("date", range.endExclusiveIso);
  const { data } = await query.limit(1000);
  for (const row of data ?? []) await supabase.rpc("unlink_transaction", { p_tx_id: row.id });
}
