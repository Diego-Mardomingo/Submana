import { NextRequest } from "next/server";
import { fetchAllPages, getAuthedClient, jsonCachedResponse, jsonError, jsonResponse, jsonServerError, unauthorized } from "@/lib/apiHelpers";
import { simplifyDebts } from "@/lib/shared/debts";
import { groupDeletedEvents, loadGroup } from "@/lib/notifications/events/subcount";
import { notifyAfter } from "@/lib/notifications/server";
import { fetchProfiles, limitSharedWrites, rpcErrorResponse, UUID } from "@/lib/shared/server";
import type { GroupDetailData, SharedEventItem, SharedExpenseItem } from "@/lib/shared/types";
import type { SplitMode } from "@/lib/shared/splits";

type Params = { params: Promise<{ id: string }> };

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 300;

/**
 * Group detail: members, the newest `limit` expenses (default 30), balances, the simplified transfers
 * ("who pays whom") and recent activity.
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
      .select("id, name, archived_at, created_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!group) return jsonError("group_not_found", 404);

    const [membersRes, expensesRes, balancesRes, eventsRes, spentRows] = await Promise.all([
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
      // Every expense (not only this page) for the group's total spent; settlements are not spending.
      fetchAllPages((from, to) =>
        supabase.from("shared_expenses").select("total_amount").eq("group_id", id).eq("kind", "expense").is("deleted_at", null).order("id").range(from, to)
      ),
    ]);
    for (const res of [membersRes, expensesRes, balancesRes, eventsRes]) if (res.error) throw res.error;

    const memberIds = (membersRes.data ?? []).map((m) => m.user_id as string);
    const nets = ((balancesRes.data ?? []) as { user_id: string; net: number | string }[]).map((b) => ({
      user_id: b.user_id,
      net_cents: Math.round(Number(b.net) * 100),
    }));
    const rows = (expensesRes.data ?? []) as unknown as (Omit<SharedExpenseItem, "shares"> & {
      shares: SharedExpenseItem["shares"];
      split_mode: SplitMode;
    })[];
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);

    const expenses: SharedExpenseItem[] = page.map((e) => ({
      ...e,
      total_amount: Number(e.total_amount),
      shares: e.shares.map((s) => ({ ...s, amount: Number(s.amount), weight: s.weight == null ? null : Number(s.weight) })),
    }));

    const involved = [...memberIds, ...expenses.flatMap((e) => [e.paid_by, ...e.shares.map((s) => s.user_id)]), ...nets.map((n) => n.user_id)];
    const profiles = await fetchProfiles(supabase, involved);
    const data: GroupDetailData = {
      group: group as GroupDetailData["group"],
      members: memberIds.flatMap((m) => profiles.get(m) ?? []),
      extra_profiles: [...profiles.values()].filter((p) => !memberIds.includes(p.user_id)),
      expenses,
      has_more: hasMore,
      total_spent_cents: spentRows.reduce((sum, row) => sum + Math.round(Number(row.total_amount) * 100), 0),
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

/** Delete the group for everyone, with its expenses and activity (any member, even with open balances). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await getAuthedClient();
  if (!user) return unauthorized();
  if (!UUID.test(id)) return jsonError("group_not_found", 404);
  const limited = await limitSharedWrites(user.id);
  if (limited) return limited;

  // The cascade removes the members: read them (and the name) before the RPC.
  const group = await loadGroup(id);
  const { error } = await supabase.rpc("delete_group", { p_group_id: id });
  if (error) return rpcErrorResponse("shared/groups/[id]", error);
  notifyAfter(() => groupDeletedEvents(group, id, user.id));
  return jsonResponse({ data: { success: true } });
}
