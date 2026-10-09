import { getAuthedClient, jsonError, jsonResponse, unauthorized } from "@/lib/apiHelpers";
import { expenseSavedEvents, loadExpense } from "@/lib/notifications/events/subcount";
import { notifyAfter } from "@/lib/notifications/server";
import { computeShares, SPLIT_MODES, toCents, type SplitMode } from "./splits";
import { limitSharedWrites, rpcErrorResponse, UUID } from "./server";

const ERRORS_BY_SPLIT: Record<string, string> = {
  invalid_total: "invalid_total",
  no_participants: "invalid_shares",
  invalid_value: "invalid_shares",
  sum_mismatch: "sum_mismatch",
};

const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/**
 * Create (`expenseId` null) or fully update a shared expense. The client sends the split INPUTS
 * (mode + per-person values); the shares in cents are always recomputed here with computeShares,
 * and the RPC re-validates membership and that the shares add up to the total to the cent.
 */
export async function saveSharedExpense(request: Request, expenseId: string | null) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  if (expenseId && !isUuid(expenseId)) return jsonError("expense_not_found", 404);
  const limited = await limitSharedWrites(user.id);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Invalid JSON body");

  const title = String(body.title ?? "").trim();
  const total = Number(body.total);
  const mode = body.split_mode as SplitMode;
  const participants: unknown[] = Array.isArray(body.participants) ? body.participants : [];

  if (title.length < 1 || title.length > 120) return jsonError("invalid_title");
  if (!Number.isFinite(total) || total <= 0 || total > 1_000_000) return jsonError("invalid_total");
  if (!SPLIT_MODES.includes(mode)) return jsonError("invalid_split_mode");
  if (!body.date || Number.isNaN(new Date(body.date).getTime())) return jsonError("missing_fields");
  if (!isUuid(body.paid_by) || (!expenseId && !isUuid(body.group_id))) return jsonError("missing_fields");
  if (participants.length === 0 || participants.length > 31) return jsonError("invalid_shares");

  const parsed = participants.map((p) => {
    const row = p as { user_id?: unknown; value?: unknown };
    const value = row.value == null ? undefined : Number(row.value);
    return { userId: row.user_id, value };
  });
  if (!parsed.every((p) => isUuid(p.userId) && (p.value === undefined || Number.isFinite(p.value)))) return jsonError("invalid_shares");

  const totalCents = toCents(total);
  const split = computeShares(
    totalCents,
    mode,
    parsed.map((p) => ({
      userId: p.userId as string,
      // exact values arrive in euros; the engine works in cents
      value: p.value === undefined ? undefined : mode === "exact" ? toCents(p.value) : p.value,
    })),
    body.paid_by
  );
  if (!split.ok) return jsonError(ERRORS_BY_SPLIT[split.error] ?? "invalid_shares");

  // For an edit, what the expense looked like before decides who is told (read before the RPC overwrites it).
  const before = expenseId ? await loadExpense(expenseId) : null;

  const { data, error } = await supabase.rpc("upsert_shared_expense", {
    p_expense_id: expenseId,
    p_group_id: expenseId ? null : body.group_id,
    p_title: title,
    p_total: totalCents / 100,
    p_date: body.date,
    p_paid_by: body.paid_by,
    p_split_mode: mode,
    p_shares: split.shares.map((s) => ({ user_id: s.userId, amount: s.cents / 100, weight: s.weight })),
  });
  if (error) return rpcErrorResponse("shared/expenses", error);

  const saved = data as { id: string; group_id: string; title: string; total_amount: number | string; paid_by: string };
  notifyAfter(() =>
    expenseSavedEvents({
      before,
      isUpdate: !!expenseId,
      saved: { id: saved.id, groupId: saved.group_id, title: saved.title, total: Number(saved.total_amount), paidBy: saved.paid_by },
      shares: split.shares,
      actorId: user.id,
    })
  );
  return jsonResponse({ data }, expenseId ? 200 : 201);
}
