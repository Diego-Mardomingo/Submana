import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "@/lib/apiHelpers";
import { toDateString } from "@/lib/date";
import type { MadridClock } from "@/lib/notifications/jobs/time";
import { expenseSavedEvents } from "@/lib/notifications/events/subcount";
import { notifyAfter } from "@/lib/notifications/server";
import { parseSharedSplit, subscriptionShares, type SharedSplit } from "@/lib/shared/subscriptionSplit";
import { toCents } from "@/lib/shared/splits";
import { chargeHistory, type ReconcilableSubscription } from "@/lib/subscriptionReconciliation";

/**
 * Shared subscriptions (issue #108, phase 4): a subscription linked to a Subcount group adds each charge
 * to the group as an expense paid by its owner, split as `shared_split` says. Charges count from the day
 * it was shared on (`shared_from`). The RPC is idempotent per charge, so every path can simply ask for
 * the charges it touched. Nothing here throws: the link, import or sync it follows must not fail.
 */

const SHARED_SELECT =
  "id, user_id, service_name, cost, start_date, end_date, frequency, frequency_value, skipped_charges, dismissed_price_charge, account_id, shared_group_id, shared_split, shared_from, price_history:subscription_price_history(cost, valid_from), charges:transactions!transactions_subscription_id_fkey(id, amount, date, subscription_charge_date)";

type SharedSub = ReconcilableSubscription & {
  id: string;
  user_id: string;
  service_name: string;
  account_id: string | null;
  shared_group_id: string;
  shared_split: unknown;
  shared_from: string;
};

/** Who was charged what: one group expense per charge. */
export interface SharedChargeCreated {
  subscriptionId: string;
  groupId: string;
  expenseId: string;
  chargeDate: string;
}

async function membersOf(supabase: SupabaseClient, groupIds: string[]) {
  const { data } = await supabase.from("group_members").select("group_id, user_id").in("group_id", groupIds);
  const byGroup = new Map<string, string[]>();
  for (const row of data ?? []) byGroup.set(row.group_id, [...(byGroup.get(row.group_id) ?? []), row.user_id]);
  return byGroup;
}

async function existingCharges(supabase: SupabaseClient, subscriptionIds: string[]) {
  const { data } = await supabase
    .from("shared_expenses")
    .select("subscription_id, subscription_charge_date")
    .in("subscription_id", subscriptionIds)
    .is("deleted_at", null);
  return new Set((data ?? []).map((r) => `${r.subscription_id}|${r.subscription_charge_date}`));
}

/** One charge → one group expense (null if it already had one or the subscription no longer shares). */
async function createChargeExpense(supabase: SupabaseClient, sub: SharedSub, members: string[], charge: { date: string; amount: number; at: string }) {
  const split = parseSharedSplit(sub.shared_split);
  if (!split || !members.includes(sub.user_id)) return null;
  const totalCents = toCents(charge.amount);
  const shares = subscriptionShares(split, members, totalCents, sub.user_id);
  if (!shares) return null;
  const { data, error } = await supabase.rpc("add_subscription_charge_expense", {
    p_subscription_id: sub.id,
    p_charge_date: charge.date,
    p_total: totalCents / 100,
    p_date: charge.at,
    p_shares: shares.map((s) => ({ user_id: s.userId, amount: s.cents / 100, weight: s.weight })),
  });
  if (error) {
    console.error("[shared subscriptions] add expense", error);
    return null;
  }
  const saved = data as { id: string | null; group_id: string; title: string; total_amount: number | string; paid_by: string } | null;
  if (!saved?.id) return null;
  // The other members get the usual "new expense" notification.
  notifyAfter(() =>
    expenseSavedEvents({
      before: null,
      isUpdate: false,
      saved: { id: saved.id!, groupId: saved.group_id, title: saved.title, total: Number(saved.total_amount), paidBy: saved.paid_by },
      shares,
      actorId: sub.user_id,
    })
  );
  return { subscriptionId: sub.id, groupId: saved.group_id, expenseId: saved.id, chargeDate: charge.date };
}

async function loadShared(supabase: SupabaseClient, filter: { userId?: string; ids?: string[] }) {
  let query = supabase.from("subscriptions").select(SHARED_SELECT).not("shared_group_id", "is", null);
  if (filter.userId) query = query.eq("user_id", filter.userId);
  if (filter.ids) query = query.in("id", filter.ids);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as SharedSub[];
}

/**
 * Adds to their group the linked charges (from `shared_from` on) of these subscriptions of the user that
 * have no group expense yet. Called after linking (by hand, automatically, confirming a review) and
 * after sharing a subscription. Works with the user's client or the service role.
 */
export async function shareLinkedCharges(supabase: SupabaseClient, userId: string, subscriptionIds: string[]): Promise<SharedChargeCreated[]> {
  const ids = [...new Set(subscriptionIds)];
  if (ids.length === 0) return [];
  try {
    const subs = (await loadShared(supabase, { userId, ids })).filter((s) => s.shared_from);
    if (subs.length === 0) return [];
    const [members, existing] = await Promise.all([membersOf(supabase, [...new Set(subs.map((s) => s.shared_group_id))]), existingCharges(supabase, subs.map((s) => s.id))]);
    const created: SharedChargeCreated[] = [];
    for (const sub of subs) {
      for (const tx of sub.charges ?? []) {
        if (tx.subscription_charge_date < sub.shared_from || existing.has(`${sub.id}|${tx.subscription_charge_date}`)) continue;
        const done = await createChargeExpense(supabase, sub, members.get(sub.shared_group_id) ?? [], { date: tx.subscription_charge_date, amount: Number(tx.amount), at: tx.date });
        if (done) created.push(done);
      }
    }
    return created;
  } catch (error) {
    console.error("[shared subscriptions] share linked charges", error);
    return [];
  }
}

/**
 * Daily cron: shared subscriptions paid from an account without a bank connection (or none) never get a
 * transaction on their own, so their charges go to the group on the expected day, for the price in
 * force. Only charges from `shared_from` on and from the last week (no flood after a pause).
 */
export async function shareUnbankedCharges(admin: SupabaseClient, clock: MadridClock): Promise<number> {
  const subs = (await fetchAllPages<SharedSub>((from, to) =>
    admin.from("subscriptions").select(SHARED_SELECT).not("shared_group_id", "is", null).order("id").range(from, to).returns<SharedSub[]>()
  )).filter((s) => s.shared_from);
  if (subs.length === 0) return 0;

  const accountIds = [...new Set(subs.map((s) => s.account_id).filter((id): id is string => !!id))];
  const banked = new Set<string>();
  if (accountIds.length > 0) {
    const { data } = await admin.from("bank_account_links").select("account_id").in("account_id", accountIds);
    for (const row of data ?? []) if (row.account_id) banked.add(row.account_id);
  }
  const unbanked = subs.filter((s) => !s.account_id || !banked.has(s.account_id));
  if (unbanked.length === 0) return 0;

  const [members, existing] = await Promise.all([membersOf(admin, [...new Set(unbanked.map((s) => s.shared_group_id))]), existingCharges(admin, unbanked.map((s) => s.id))]);
  const weekAgo = toDateString(new Date(clock.year, clock.month - 1, clock.day - 7, 12));
  let created = 0;
  for (const sub of unbanked) {
    for (const charge of chargeHistory(sub, clock.today)) {
      if (charge.status === "upcoming" || charge.status === "skipped") continue;
      if (charge.date > clock.date || charge.date < sub.shared_from || charge.date < weekAgo) continue;
      if (existing.has(`${sub.id}|${charge.date}`)) continue;
      const done = await createChargeExpense(admin, sub, members.get(sub.shared_group_id) ?? [], {
        date: charge.date,
        amount: charge.tx ? Number(charge.tx.amount) : charge.expected,
        at: charge.tx?.date ?? `${charge.date}T12:00:00Z`,
      });
      if (done) created++;
    }
  }
  return created;
}

/** The group expense of one charge, if any (to offer deleting it when the charge is unlinked). */
export async function chargeExpense(supabase: SupabaseClient, subscriptionId: string, chargeDate: string) {
  const { data } = await supabase
    .from("shared_expenses")
    .select("id, group_id")
    .eq("subscription_id", subscriptionId)
    .eq("subscription_charge_date", chargeDate)
    .is("deleted_at", null)
    .maybeSingle();
  return data as { id: string; group_id: string } | null;
}

/**
 * `shared_group_id` + `shared_split` from a create / edit body: undefined when the body doesn't touch
 * them, an error code when invalid. Everyone in the split must be in the group (and so must I; the
 * database checks that too).
 */
export async function readSharing(
  supabase: SupabaseClient,
  userId: string,
  body: Record<string, unknown>
): Promise<{ shared_group_id: string | null; shared_split: SharedSplit | null } | { error: "group_not_found" | "invalid_shares" } | undefined> {
  if (body.shared_group_id === undefined) return undefined;
  if (body.shared_group_id === null || body.shared_group_id === "") return { shared_group_id: null, shared_split: null };
  if (typeof body.shared_group_id !== "string") return { error: "group_not_found" };
  const split = parseSharedSplit(body.shared_split);
  if (!split) return { error: "invalid_shares" };
  const { data: group } = await supabase.from("groups").select("id, archived_at").eq("id", body.shared_group_id).maybeSingle();
  if (!group || group.archived_at) return { error: "group_not_found" };
  const members = (await membersOf(supabase, [group.id])).get(group.id) ?? [];
  if (!members.includes(userId)) return { error: "group_not_found" };
  if (!split.participants.every((p) => members.includes(p.user_id))) return { error: "invalid_shares" };
  return { shared_group_id: group.id, shared_split: split };
}
