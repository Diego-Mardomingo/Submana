import { NextRequest } from "next/server";
import {
  adjustAccountBalance,
  getAuthedClient,
  jsonCachedResponse,
  jsonError,
  jsonResponse,
  parseRequestBody,
  readTransactionInput,
  signedAmount,
  unauthorized,
} from "@/lib/apiHelpers";
import { calendarMonthsUtcHalfOpenRange } from "@/lib/date";

export async function GET(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const params = request.nextUrl.searchParams;
  const year = parseInt(params.get("year") ?? "", 10);
  const month = parseInt(params.get("month") ?? "", 10); // 1-12
  const accountId = params.get("account_id");

  let query = supabase
    .from("transactions")
    .select("*, account:accounts(name, color), category:categories!category_id(name), subcategory:categories!subcategory_id(name)")
    .eq("user_id", user.id)
    .order("date", { ascending: false });
  if (year && month) {
    const { startIso, endExclusiveIso } = calendarMonthsUtcHalfOpenRange(year, month, year, month);
    query = query.gte("date", startIso).lt("date", endExclusiveIso);
  }
  if (accountId) query = query.eq("account_id", accountId);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);
  return jsonCachedResponse({ data }, 30, 120);
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const tx = readTransactionInput(await parseRequestBody(request));
  if (isNaN(tx.amount) || !tx.type || !tx.date) return jsonError("missing_fields");

  const { data, error } = await supabase
    .from("transactions")
    .insert({ user_id: user.id, ...tx })
    .select()
    .single();
  if (error) return jsonError(error.message, 500);

  await adjustAccountBalance(supabase, tx.account_id, signedAmount(tx));
  return jsonResponse({ data }, 201);
}
