import { getAuthedClient, jsonCachedResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { loadOwedPairs } from "@/lib/shared/server";
import type { BalancesData, FriendBalance } from "@/lib/shared/types";

/** What each friend owes me / I owe them across all groups (from the simplified transfers). */
export async function GET() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  try {
    const { pairs, profiles } = await loadOwedPairs(supabase, user.id);
    const byFriend = new Map<string, FriendBalance>();
    for (const pair of pairs) {
      const profile = profiles.get(pair.friendId);
      if (!profile) continue;
      const entry = byFriend.get(pair.friendId) ?? { profile, cents: 0, groups: [] };
      entry.cents += pair.cents;
      entry.groups.push({ group_id: pair.groupId, cents: pair.cents });
      byFriend.set(pair.friendId, entry);
    }
    const friends = [...byFriend.values()].filter((f) => f.cents !== 0).sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents));
    const data: BalancesData = {
      friends,
      owed_to_me_cents: friends.filter((f) => f.cents > 0).reduce((s, f) => s + f.cents, 0),
      i_owe_cents: friends.filter((f) => f.cents < 0).reduce((s, f) => s - f.cents, 0),
    };
    return jsonCachedResponse({ data });
  } catch (error) {
    return jsonServerError("shared/balances", error);
  }
}
