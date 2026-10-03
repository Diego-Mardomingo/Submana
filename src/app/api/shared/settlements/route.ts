import { NextRequest } from "next/server";
import { getAuthedClient, jsonError, jsonResponse, unauthorized } from "@/lib/apiHelpers";
import { limitSharedWrites, rpcErrorResponse, UUID } from "@/lib/shared/server";
import { toCents } from "@/lib/shared/splits";

/**
 * Record a settlement: `from` (debtor) paid `to` (creditor) `amount` euros inside a group. I must be
 * one of the two.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  const limited = await limitSharedWrites(user.id);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Invalid JSON body");
  const amount = Number(body.amount);
  if (![body.group_id, body.from, body.to].every((v) => typeof v === "string" && UUID.test(v))) return jsonError("invalid_settlement");
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return jsonError("invalid_total");
  const date = body.date ? new Date(body.date) : new Date();
  if (Number.isNaN(date.getTime())) return jsonError("missing_fields");

  const { data, error } = await supabase.rpc("record_settlement", {
    p_group_id: body.group_id,
    p_from: body.from,
    p_to: body.to,
    p_amount: toCents(amount) / 100,
    p_date: date.toISOString(),
  });
  if (error) return rpcErrorResponse("shared/settlements", error);
  return jsonResponse({ data }, 201);
}
