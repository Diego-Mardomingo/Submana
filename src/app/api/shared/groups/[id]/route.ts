import { NextRequest } from "next/server";
import { getAuthedClient, jsonCachedResponse, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { simplifyDebts } from "@/lib/shared/debts";
import { fetchProfiles, limitSharedWrites, rpcErrorResponse, UUID } from "@/lib/shared/server";
import type { GroupDetailData, SharedEventItem, SharedExpenseItem } from "@/lib/shared/types";
import type { SplitMode } from "@/lib/shared/splits";

type Params = { params: Promise<{ id: string }> };

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 300;

/**
 * Group detail: members, the newest `limit` expenses (default 30), balances, the simplified transfers
 * ("who pays whom") and recent activity. `bank_mismatch` only ever looks at MY OWN linked row.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  if (!UUID.test(id)) return jsonError("group_not_found", 404);

  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") ?? "", 10) || DEFAULT_LIMIT));

  try {
    const { data: group, error } = await supabase
      .from("groups")
      .select("id, name, kind, archived_at, created_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!group) return jsonError("group_not_found", 404);

    const [membersRes, expensesRes, balancesRes, eventsRes] = await Promise.all([
      supabase.from("group_members").select("user_id").eq("group_id", id),
      supabase
        .from("shared_expenses")
        .select("id, group_id, kind, title, total_amount, date, paid_by, split_mode, created_by, updated_by, created_at, shares:shared_expense_shares(user_id, amount, weight)")
        .eq("group_id", id)
        .is("deleted_at", null)
        .order("date", { ascending: false })
        .order("id", { ascending: true })
        .range(0, limit),
      supabase.rpc("group_balances", { p_group_id: id }),
      supabase
        .from("shared_expense_events")
        .select("id, action, actor_id, expense_id, summary, created_at")
        .eq("group_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    for (const res of [membersRes, expensesRes, balancesRes, eventsRes]) if (res.error) throw res.error;

    const memberIds = (membersRes.data ?? []).map((m) => m.user_id as string);
    const nets = ((balancesRes.data ?? []) as { user_id: string; net: number | string }[]).map((b) => ({
      user_id: b.user_id,
      net_cents: Math.round(Number(b.net) * 100),
    }));
    const rows = (expensesRes.data ?? []) as unknown as (Omit<SharedExpenseItem, "my_transaction_id" | "my_transaction_virtual" | "bank_mismatch" | "bank_amount" | "shares"> & {
      shares: SharedExpenseItem["shares"];
      split_mode: SplitMode;
    })[];
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);

    // My own rows linked to these expenses (RLS only returns mine anyway).
    const { data: mine, error: mineError } = page.length
      ? await supabase.from("transactions").select("id, shared_expense_id, amount, source").eq("user_id", user.id).in("shared_expense_id", page.map((e) => e.id))
      : { data: [], error: null };
    if (mineError) throw mineError;
    const mineByExpense = new Map((mine ?? []).map((t) => [t.shared_expense_id as string, t]));

    const expenses: SharedExpenseItem[] = page.map((e) => {
      const tx = mineByExpense.get(e.id);
      const virtual = tx?.source === "shared";
      const bankAmount = tx && !virtual ? Number(tx.amount) : null;
      return {
        ...e,
        total_amount: Number(e.total_amount),
        shares: e.shares.map((s) => ({ ...s, amount: Number(s.amount), weight: s.weight == null ? null : Number(s.weight) })),
        my_transaction_id: tx ? (tx.id as string) : null,
        my_transaction_virtual: virtual,
        bank_mismatch: e.kind === "expense" && e.paid_by === user.id && bankAmount !== null && Math.abs(bankAmount - Number(e.total_amount)) > 0.005,
        bank_amount: bankAmount,
      };
    });

    const involved = [...memberIds, ...expenses.flatMap((e) => [e.paid_by, ...e.shares.map((s) => s.user_id)]), ...nets.map((n) => n.user_id)];
    const profiles = await fetchProfiles(supabase, involved);
    const data: GroupDetailData = {
      group: group as GroupDetailData["group"],
      members: memberIds.flatMap((m) => profiles.get(m) ?? []),
      extra_profiles: [...profiles.values()].filter((p) => !memberIds.includes(p.user_id)),
      expenses,
      has_more: hasMore,
      nets,
      transfers: simplifyDebts(Object.fromEntries(nets.map((n) => [n.user_id, n.net_cents]))),
      events: (eventsRes.data ?? []) as SharedEventItem[],
    };
    return jsonCachedResponse({ data });
  } catch (error) {
    return jsonServerError("shared/groups/[id]", error);
  }
}

async function updateGroup(id: string, patch: { name?: string; archived?: boolean }) {
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  if (!UUID.test(id)) return jsonError("group_not_found", 404);
  const limited = await limitSharedWrites(user.id);
  if (limited) return limited;

  const { data, error } = await supabase.rpc("update_group", {
    p_group_id: id,
    p_name: patch.name ?? null,
    p_archived: patch.archived ?? null,
  });
  if (error) return rpcErrorResponse("shared/groups/[id]", error);
  return jsonResponse({ data });
}

/** Rename and/or (un)archive. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Invalid JSON body");
  const patch: { name?: string; archived?: boolean } = {};
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (typeof body.archived === "boolean") patch.archived = body.archived;
  if (patch.name !== undefined && (patch.name.length < 1 || patch.name.length > 60)) return jsonError("invalid_name");
  return updateGroup(id, patch);
}

/** Archive (groups are never hard-deleted: their balances may still matter). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  return updateGroup(id, { archived: true });
}
