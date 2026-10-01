import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonResponse, jsonServerError, parseRequestBody } from "@/lib/apiHelpers";
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
    .select("id")
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

  // Borrado y reversión del saldo en una sola transacción de Postgres.
  const { data: deletedCount, error } = await supabase.rpc("delete_account_transactions", {
    p_account_id: accountId,
    p_user_id: user.id,
    p_from: rangeStartIso ?? null,
    p_to: rangeEndExclusiveIso ?? null,
  });

  if (error) {
    return jsonServerError("DELETE /api/crud/accounts/[id]/transactions", error);
  }

  return jsonResponse({ data: { deleted_count: Number(deletedCount ?? 0) } });
}
