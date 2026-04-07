import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse, parseRequestBody } from "@/lib/apiHelpers";
import { calendarMonthsUtcHalfOpenRange } from "@/lib/date";
import { NextRequest } from "next/server";

function compareYearMonth(
  aY: number,
  aM: number,
  bY: number,
  bM: number
): number {
  if (aY !== bY) return aY - bY;
  return aM - bM;
}

const DELETE_CHUNK = 500;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: accountId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  if (!accountId) {
    return jsonError("missing_id", 400);
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("id, balance")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();

  if (!account) {
    return jsonError("Account not found", 404);
  }

  const { body } = await parseRequestBody(request);
  const mode = body.mode || "";

  if (mode !== "all" && mode !== "range") {
    return jsonError("invalid_mode", 400);
  }

  let rangeStartIso: string | undefined;
  let rangeEndExclusiveIso: string | undefined;

  if (mode === "range") {
    const startYear = parseInt(body.startYear || "", 10);
    const startMonth = parseInt(body.startMonth || "", 10);
    const endYear = parseInt(body.endYear || "", 10);
    const endMonth = parseInt(body.endMonth || "", 10);

    if (
      Number.isNaN(startYear) ||
      Number.isNaN(startMonth) ||
      Number.isNaN(endYear) ||
      Number.isNaN(endMonth) ||
      startMonth < 1 ||
      startMonth > 12 ||
      endMonth < 1 ||
      endMonth > 12
    ) {
      return jsonError("invalid_range", 400);
    }

    if (compareYearMonth(startYear, startMonth, endYear, endMonth) > 0) {
      return jsonError("range_order", 400);
    }

    const bounds = calendarMonthsUtcHalfOpenRange(
      startYear,
      startMonth,
      endYear,
      endMonth
    );
    rangeStartIso = bounds.startIso;
    rangeEndExclusiveIso = bounds.endExclusiveIso;
  }

  let txQuery = supabase
    .from("transactions")
    .select("id, amount, type")
    .eq("user_id", user.id)
    .eq("account_id", accountId);

  if (rangeStartIso !== undefined && rangeEndExclusiveIso !== undefined) {
    txQuery = txQuery
      .gte("date", rangeStartIso)
      .lt("date", rangeEndExclusiveIso);
  }

  const { data: transactions, error: selectError } = await txQuery;

  if (selectError) {
    return jsonError(selectError.message, 500);
  }

  const rows = transactions ?? [];
  if (rows.length === 0) {
    return jsonResponse({ data: { deleted_count: 0 } });
  }

  let balanceDelta = 0;
  for (const tx of rows) {
    const amt = Number(tx.amount);
    if (tx.type === "income") balanceDelta -= amt;
    else balanceDelta += amt;
  }

  const ids = rows.map((r) => r.id);
  for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
    const chunk = ids.slice(i, i + DELETE_CHUNK);
    const { error: delError } = await supabase
      .from("transactions")
      .delete()
      .in("id", chunk)
      .eq("user_id", user.id);

    if (delError) {
      return jsonError(delError.message, 500);
    }
  }

  const newBalance = Number(account.balance) + balanceDelta;
  const { error: updateError } = await supabase
    .from("accounts")
    .update({ balance: newBalance })
    .eq("id", accountId)
    .eq("user_id", user.id);

  if (updateError) {
    return jsonError(updateError.message, 500);
  }

  return jsonResponse({ data: { deleted_count: rows.length } });
}
