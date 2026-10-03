import { NextRequest } from "next/server";
import { getAccountAccess, getAuthedClient, jsonCachedResponse, jsonError, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { POSSIBLE_THRESHOLD } from "@/lib/dedup/classifyImport";
import { matchScore } from "@/lib/dedup/matchScore";

const DAY_MS = 86_400_000;
const MAX_RESULTS = 3;

/**
 * Bank-backed transactions (booked_at set) that look like a manual one being typed: same account,
 * type and cents, booked within [date - 2d, date + 5d]. Lets the form offer "use that one" instead of
 * creating a twin the next statement import would have to reconcile.
 */
export async function GET(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const params = request.nextUrl.searchParams;
  const accountId = params.get("account_id");
  const amount = parseFloat(params.get("amount") ?? "");
  const type = params.get("type");
  const date = params.get("date") ?? "";
  const description = params.get("description") ?? "";
  const dateMs = date ? new Date(date).getTime() : NaN;
  if (!accountId || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(dateMs)) return jsonError("missing_fields");
  if (type !== "income" && type !== "expense") return jsonError("invalid_type");
  const access = await getAccountAccess(supabase, user.id, accountId);
  if (!access) return jsonError("Account not found", 404);

  // One extra day each side absorbs time zone edges; the exact gate runs on calendar days in matchScore.
  // Joint accounts dedupe across every member's rows.
  let query = supabase
    .from("transactions")
    .select("id, account_id, type, amount, date, booked_at, description, bank_description, category_id, subcategory_id")
    .eq("account_id", accountId);
  if (!access.isJoint) query = query.eq("user_id", user.id);
  const { data, error } = await query
    .eq("type", type)
    .eq("amount", amount)
    .not("booked_at", "is", null)
    .gte("booked_at", new Date(dateMs - 3 * DAY_MS).toISOString())
    .lte("booked_at", new Date(dateMs + 6 * DAY_MS + DAY_MS).toISOString())
    .limit(50);
  if (error) return jsonServerError("crud/transactions/similar", error);

  const scored = (data ?? []).flatMap((row) => {
    const match = matchScore(
      { type: row.type, amount: row.amount, date: row.booked_at, description: row.bank_description ?? row.description },
      { type, amount, date, description }
    );
    return match && match.score >= POSSIBLE_THRESHOLD ? [{ ...row, score: match.score, deltaDays: match.deltaDays }] : [];
  });
  scored.sort((a, b) => b.score - a.score);
  return jsonCachedResponse({ data: scored.slice(0, MAX_RESULTS) });
}
