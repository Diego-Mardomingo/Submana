import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, jsonServerError, listAccessibleAccounts, unauthorized } from "@/lib/apiHelpers";
import { calendarMonthsUtcHalfOpenRange } from "@/lib/date";
import { PICK_WINDOW_DAYS, scoreCandidate } from "@/lib/subscriptionReconciliation";
import { isDay, readSubscription } from "@/lib/subscriptionsServer";

type Params = { params: Promise<{ id: string }> };

const MAX_RESULTS = 30;

/**
 * Transactions that could be the charge of `charge` (YYYY-MM-DD) of a subscription, best first: expenses
 * not linked to any subscription, within ±15 days, in the subscription's account (`all=1`: any account I
 * can see). `q` filters by description instead of the window.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const search = request.nextUrl.searchParams;
  const chargeDate = search.get("charge");
  if (!isDay(chargeDate)) return jsonError("invalid_charge_date");
  const q = (search.get("q") ?? "").trim().slice(0, 60);

  const sub = await readSubscription(supabase, user.id, id);
  if (!sub) return jsonError("Subscription not found", 404);

  const { ids } = await listAccessibleAccounts(supabase, user.id);
  const accounts = sub.account_id && search.get("all") !== "1" ? ids.filter((a) => a === sub.account_id) : ids;
  if (accounts.length === 0) return jsonResponse({ data: [] });

  const [y, m, d] = chargeDate.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, d - PICK_WINDOW_DAYS - 1)).toISOString();
  const to = new Date(Date.UTC(y, m - 1, d + PICK_WINDOW_DAYS + 2)).toISOString();

  let query = supabase
    .from("transactions")
    .select("id, amount, date, type, description, bank_description, account_id, category_id, subcategory_id, account:accounts(name, color)")
    .in("account_id", accounts)
    .eq("type", "expense")
    .is("subscription_id", null)
    .order("date", { ascending: false })
    .limit(q ? MAX_RESULTS : 200);
  if (q) {
    const pattern = `%${q.replace(/[%_,()]/g, " ")}%`;
    query = query.or(`description.ilike.${pattern},bank_description.ilike.${pattern}`);
    // A search looks a year around the charge.
    const range = calendarMonthsUtcHalfOpenRange(y - 1, m, y + 1, m);
    query = query.gte("date", range.startIso).lt("date", range.endExclusiveIso);
  } else {
    query = query.gte("date", from).lt("date", to);
  }

  const { data, error } = await query;
  if (error) return jsonServerError("subscriptions/candidates", error);
  const ranked = (data ?? [])
    .map((tx) => ({ ...tx, ...scoreCandidate(sub, tx, chargeDate) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);
  return jsonResponse({ data: ranked });
}
