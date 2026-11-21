import { NextRequest } from "next/server";
import { getAuthedClient, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { explainCard, indexHistory, merchantOf, settleMatch, shownInDeck, type MovementLite, type ReviewMode } from "@/lib/review/classify";
import { loadHistory, loadRules } from "@/lib/review/server";
import type { ReviewItem, ReviewQueue, ReviewSummary } from "@/lib/review/types";

/** At most this many cards per session; the rest show up after these are done. */
const DECK_LIMIT = 60;
/** Categories where a meal or plan with friends is likely: restaurants and leisure. */
const SHAREABLE_CATEGORIES = new Set(["11111111-1111-1111-1111-111111111303", "11111111-1111-1111-1111-111111111403"]);
const DAY_MS = 86_400_000;

interface Row extends Omit<ReviewItem, "why" | "alternatives" | "hint" | "pattern" | "account" | "subscription"> {
  subscription_id: string | null;
  account: { id: string; name: string; color: string | null; is_joint: boolean } | null;
  subscription: { id: string; service_name: string; icon: string | null } | null;
}

/** Madrid hour of a timestamp (dinner time makes a shared expense more likely). */
const hourOf = (iso: string) => Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Madrid" }).format(new Date(iso)));

/**
 * The cards waiting for me (the movements still pending or left for later), in the mode I chose. `?summary=1`:
 * only how many and the first three (for the nav, Home and the +), without reading the history.
 */
export async function GET(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const [{ data: settings }, { data: rows, error }, { count: groups }] = await Promise.all([
    supabase.from("notification_settings").select("review_mode").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("transactions")
      .select(
        "id, description, bank_description, amount, type, date, category_id, subcategory_id, review_state, review_reason, subscription_id, account:accounts(id, name, color, is_joint), subscription:subscriptions!transactions_subscription_id_fkey(id, service_name, icon)"
      )
      .eq("user_id", user.id)
      .in("review_state", ["pending", "later"])
      .order("date", { ascending: false })
      .limit(500),
    supabase.from("group_members").select("group_id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  if (error) return jsonServerError("review", error);
  const mode: ReviewMode = settings?.review_mode === "all" ? "all" : "doubt";

  // Waiting ones first, then those left for later; newest first within each.
  const open = ((rows ?? []) as unknown as Row[])
    .filter((row) => !row.account?.is_joint && shownInDeck(row, mode))
    .sort((a, b) => Number(a.review_state === "later") - Number(b.review_state === "later"))
    .slice(0, DECK_LIMIT);

  if (request.nextUrl.searchParams.get("summary") === "1") {
    const summary: ReviewSummary = {
      count: open.length,
      preview: open.slice(0, 3).map((row) => ({ id: row.id, description: row.description, category_id: row.category_id, subcategory_id: row.subcategory_id, type: row.type })),
    };
    return jsonResponse({ data: summary });
  }

  const [rules, history] = await Promise.all([loadRules(supabase, user.id), open.length ? loadHistory(supabase, user.id, open.map((r) => r.id)) : []]);
  const byMerchant = indexHistory(history);

  // The expense each possible payback answers to, for "arrived 18 minutes after La Tasquita".
  const settles = open.filter((row) => row.review_reason === "settle");
  let expenses: MovementLite[] = [];
  if (settles.length > 0) {
    const times = settles.map((row) => Date.parse(row.date));
    const { data } = await supabase
      .from("transactions")
      .select("id, amount, type, date, description")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .gte("date", new Date(Math.min(...times) - DAY_MS).toISOString())
      .lte("date", new Date(Math.max(...times)).toISOString());
    expenses = (data ?? []) as MovementLite[];
  }

  const items: ReviewItem[] = open.map(({ subscription_id, account, ...row }) => {
    const pattern = merchantOf(row);
    const match = row.review_reason === "settle" ? settleMatch(row, expenses) : null;
    const { why, alternatives } = explainCard({
      tx: { ...row, subscription_id },
      rule: rules.get(pattern) ?? null,
      merchantHistory: byMerchant.get(pattern) ?? [],
      settleWith: match ? { description: match.description ?? null, minutes: Math.round((Date.parse(row.date) - Date.parse(match.date)) / 60_000) } : null,
    });
    const hour = hourOf(row.date);
    const shareable =
      row.type === "expense" &&
      (row.review_reason === "new" || row.review_reason === "doubt") &&
      Number(row.amount) >= 15 &&
      ((!!row.subcategory_id && SHAREABLE_CATEGORIES.has(row.subcategory_id)) || hour >= 20 || hour < 2);
    return {
      ...row,
      amount: Number(row.amount),
      date: row.date,
      account: account ? { id: account.id, name: account.name, color: account.color } : null,
      subscription: row.subscription ?? null,
      why,
      alternatives,
      hint: groups ? (match ? "settle" : shareable ? "subcount" : null) : null,
      pattern,
    };
  });

  const queue: ReviewQueue = { mode, items, hasGroups: !!groups };
  return jsonResponse({ data: queue });
}
