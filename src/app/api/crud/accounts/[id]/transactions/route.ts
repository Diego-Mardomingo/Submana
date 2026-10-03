import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, jsonServerError, parseRequestBody, unauthorized } from "@/lib/apiHelpers";
import { calendarMonthsUtcHalfOpenRange } from "@/lib/date";
import { unlinkLinkedTransactions } from "@/lib/shared/server";

/** Deletes all (or a month range of) an account's transactions and reverts their balance effect. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: accountId } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();

  const { data: account } = await supabase.from("accounts").select("id").eq("id", accountId).eq("user_id", user.id).single();
  if (!account) return jsonError("Account not found", 404);

  const body = await parseRequestBody(request);
  if (body.mode !== "all" && body.mode !== "range") return jsonError("invalid_mode");

  let range: { startIso: string; endExclusiveIso: string } | undefined;
  if (body.mode === "range") {
    const [startYear, startMonth, endYear, endMonth] = [body.startYear, body.startMonth, body.endYear, body.endMonth].map((v) => parseInt(v ?? "", 10));
    const validMonth = (m: number) => Number.isInteger(m) && m >= 1 && m <= 12;
    if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || !validMonth(startMonth) || !validMonth(endMonth)) {
      return jsonError("invalid_range");
    }
    if (startYear * 12 + startMonth > endYear * 12 + endMonth) return jsonError("range_order");
    range = calendarMonthsUtcHalfOpenRange(startYear, startMonth, endYear, endMonth);
  }

  await unlinkLinkedTransactions(supabase, user.id, accountId, range);

  // Deletes and reverts the balance in a single Postgres transaction.
  const { data: deleted, error } = await supabase.rpc("delete_account_transactions", {
    p_account_id: accountId,
    p_user_id: user.id,
    p_from: range?.startIso ?? null,
    p_to: range?.endExclusiveIso ?? null,
  });
  if (error) return jsonServerError("crud/accounts/[id]/transactions", error);
  return jsonResponse({ data: { deleted_count: Number(deleted ?? 0) } });
}
