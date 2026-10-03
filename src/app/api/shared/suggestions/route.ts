import { getAuthedClient, jsonCachedResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { loadOwedPairs } from "@/lib/shared/server";
import { SETTLEMENT_WINDOW_DAYS, suggestSettlements } from "@/lib/shared/settlementMatch";
import type { SettlementSuggestionItem } from "@/lib/shared/types";

/** Which of my unlinked bank transactions of the last 60 days look like paying back / being paid back. */
export async function GET() {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  try {
    const { pairs, profiles } = await loadOwedPairs(supabase, user.id);
    if (pairs.length === 0) return jsonCachedResponse({ data: [] });

    const since = new Date(Date.now() - SETTLEMENT_WINDOW_DAYS * 86_400_000).toISOString();
    const { data: txs, error } = await supabase
      .from("transactions")
      // Joint accounts are shared with other people: their rows are never suggested as settlements.
      .select("id, type, amount, date, description, account:accounts!inner(is_joint)")
      .eq("account.is_joint", false)
      .eq("user_id", user.id)
      .is("shared_expense_id", null)
      .not("account_id", "is", null)
      .gte("date", since)
      .order("date", { ascending: false })
      .limit(500);
    if (error) throw error;

    const data: SettlementSuggestionItem[] = suggestSettlements(txs ?? [], pairs).flatMap((s) => {
      const friend = profiles.get(s.friendId);
      return friend
        ? [{ tx_id: s.txId, group_id: s.groupId, friend, direction: s.direction, amount_cents: s.amountCents, exact: s.exact, score: s.score }]
        : [];
    });
    return jsonCachedResponse({ data });
  } catch (error) {
    return jsonServerError("shared/suggestions", error);
  }
}
