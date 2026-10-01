import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, parseRequestBody, signedAmount, unauthorized } from "@/lib/apiHelpers";
import { calendarMonthsUtcHalfOpenRange } from "@/lib/date";

/** Deletes all (or a month range of) an account's transactions and reverts their balance effect. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: accountId } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { data: account } = await supabase.from("accounts").select("id, balance").eq("id", accountId).eq("user_id", user.id).single();
  if (!account) return jsonError("Account not found", 404);

  const body = await parseRequestBody(request);
  if (body.mode !== "all" && body.mode !== "range") return jsonError("invalid_mode");

  let query = supabase.from("transactions").select("id, amount, type").eq("user_id", user.id).eq("account_id", accountId);
  if (body.mode === "range") {
    const [startYear, startMonth, endYear, endMonth] = [body.startYear, body.startMonth, body.endYear, body.endMonth].map((v) => parseInt(v ?? "", 10));
    const validMonth = (m: number) => Number.isInteger(m) && m >= 1 && m <= 12;
    if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || !validMonth(startMonth) || !validMonth(endMonth)) {
      return jsonError("invalid_range");
    }
    if (startYear * 12 + startMonth > endYear * 12 + endMonth) return jsonError("range_order");
    const { startIso, endExclusiveIso } = calendarMonthsUtcHalfOpenRange(startYear, startMonth, endYear, endMonth);
    query = query.gte("date", startIso).lt("date", endExclusiveIso);
  }

  const { data: rows, error } = await query;
  if (error) return jsonError(error.message, 500);
  if (!rows.length) return jsonResponse({ data: { deleted_count: 0 } });

  for (let i = 0; i < rows.length; i += 500) {
    const ids = rows.slice(i, i + 500).map((r) => r.id);
    const { error: delError } = await supabase.from("transactions").delete().in("id", ids).eq("user_id", user.id);
    if (delError) return jsonError(delError.message, 500);
  }

  const balance = Number(account.balance) - rows.reduce((sum, tx) => sum + signedAmount(tx), 0);
  const { error: updateError } = await supabase.from("accounts").update({ balance }).eq("id", accountId).eq("user_id", user.id);
  if (updateError) return jsonError(updateError.message, 500);
  return jsonResponse({ data: { deleted_count: rows.length } });
}
