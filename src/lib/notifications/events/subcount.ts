/**
 * Subcount notification events: who gets told about expenses, settlements and group changes.
 * The recipient rules are pure (tested); the loaders read with the service role and never throw.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotifyEvent } from "../core";
import { euros, loadProfiles, toCents } from "./common";

export interface ExpenseState {
  title: string;
  /** Euros */
  total: number;
  paidBy: string;
  shares: { userId: string; amount: number }[];
}

export interface StoredExpense extends ExpenseState {
  id: string;
  groupId: string;
  kind: "expense" | "settlement";
}

/** The user's own share in euros (0 when they are not part of the split). */
export function shareOf(expense: ExpenseState, userId: string): number {
  return euros(expense.shares.find((s) => s.userId === userId)?.amount);
}

/** Payer (even with a 0 share) plus everyone with a share above 0. */
export function expenseParticipants(expense: ExpenseState): string[] {
  return [...new Set([expense.paidBy, ...expense.shares.filter((s) => toCents(s.amount) > 0).map((s) => s.userId)])];
}

/** The edit matters to this user: the total or the payer changed, or their own share did. */
export function expenseChangedFor(before: ExpenseState, after: ExpenseState, userId: string): boolean {
  return toCents(before.total) !== toCents(after.total) || before.paidBy !== after.paidBy || toCents(shareOf(before, userId)) !== toCents(shareOf(after, userId));
}

/** Participants before or after the edit, minus the author, for whom the edit changed something (title and date edits notify nobody). */
export function expenseUpdateRecipients(before: ExpenseState, after: ExpenseState, actorId: string): string[] {
  const everyone = new Set([...expenseParticipants(before), ...expenseParticipants(after)]);
  return [...everyone].filter((id) => id !== actorId && expenseChangedFor(before, after, id));
}

/** Participants minus the author (new and deleted expenses). */
export function expenseRecipients(expense: ExpenseState, actorId: string): string[] {
  return expenseParticipants(expense).filter((id) => id !== actorId);
}

type ExpenseKind = "added" | "updated" | "deleted";

/** One event per recipient; each carries that recipient's own share. */
export function expenseEvents(args: {
  kind: ExpenseKind;
  groupId: string;
  groupName: string;
  expenseId: string;
  /** Shares come from here (the expense after the edit, or the deleted one). */
  expense: ExpenseState;
  recipients: readonly string[];
  actorId: string;
  actorName: string;
}): NotifyEvent[] {
  const { kind, groupId, groupName, expenseId, expense, actorId, actorName } = args;
  return args.recipients.map(
    (userId) =>
      ({
        userId,
        type: `shared.expense_${kind}`,
        actorId,
        entityType: "shared_expense",
        entityId: expenseId,
        params: { groupId, groupName, expenseId, title: expense.title, actorName, total: euros(expense.total), share: shareOf(expense, userId) },
      }) as NotifyEvent
  );
}

/** Settlement: only the other party is told. */
export function settlementEvents(args: {
  groupId: string;
  groupName: string;
  expenseId: string;
  from: string;
  to: string;
  amount: number;
  actorId: string;
  actorName: string;
}): NotifyEvent[] {
  const { from, to, actorId } = args;
  if (actorId !== from && actorId !== to) return [];
  const actorPaid = actorId === from;
  return [
    {
      userId: actorPaid ? to : from,
      type: "shared.settlement",
      actorId,
      entityType: "shared_expense",
      entityId: args.expenseId,
      params: { groupId: args.groupId, groupName: args.groupName, actorName: args.actorName, amount: euros(args.amount), payer: actorPaid ? "actor" : "recipient" },
    },
  ];
}

// --- loaders ------------------------------------------------------------------------------------

type ExpenseRow = { id: string; group_id: string; kind: "expense" | "settlement"; title: string; total_amount: number | string; paid_by: string; shares: { user_id: string; amount: number | string }[] | null };

const EXPENSE_COLUMNS = "id, group_id, kind, title, total_amount, paid_by, shares:shared_expense_shares(user_id, amount)";

/** An expense with its shares as they are now. Read it BEFORE an edit or delete. Null when missing or on error. */
export async function loadExpense(expenseId: string): Promise<StoredExpense | null> {
  try {
    const { data, error } = await createAdminClient().from("shared_expenses").select(EXPENSE_COLUMNS).eq("id", expenseId).maybeSingle();
    if (error) throw error;
    return data ? toExpense(data as unknown as ExpenseRow) : null;
  } catch (error) {
    console.error("[notifications] loadExpense", error);
    return null;
  }
}

const toExpense = (row: ExpenseRow): StoredExpense => ({
  id: row.id,
  groupId: row.group_id,
  kind: row.kind,
  title: row.title,
  total: euros(row.total_amount),
  paidBy: row.paid_by,
  shares: (row.shares ?? []).map((s) => ({ userId: s.user_id, amount: euros(s.amount) })),
});

/** Name and members of a group (service role: still works while the group is being deleted if read before). Null on error. */
export async function loadGroup(groupId: string): Promise<{ name: string; memberIds: string[] } | null> {
  try {
    const admin = createAdminClient();
    const [{ data: group, error }, { data: members, error: membersError }] = await Promise.all([
      admin.from("groups").select("name").eq("id", groupId).maybeSingle(),
      admin.from("group_members").select("user_id").eq("group_id", groupId),
    ]);
    if (error) throw error;
    if (membersError) throw membersError;
    return group ? { name: group.name as string, memberIds: (members ?? []).map((m) => m.user_id as string) } : null;
  } catch (error) {
    console.error("[notifications] loadGroup", error);
    return null;
  }
}

// --- composed (run inside notifyAfter) ----------------------------------------------------------

/** A shared expense was created (`before` null) or edited (`before` read before the RPC). */
export async function expenseSavedEvents(args: {
  before: StoredExpense | null;
  /** Edit of an existing expense: without `before` there is nothing to compare, so nobody is told. */
  isUpdate: boolean;
  saved: { id: string; groupId: string; title: string; total: number; paidBy: string };
  shares: { userId: string; cents: number }[];
  actorId: string;
}): Promise<NotifyEvent[]> {
  const { before, isUpdate, saved, actorId } = args;
  if (isUpdate && !before) return [];
  const after: ExpenseState = { title: saved.title, total: saved.total, paidBy: saved.paidBy, shares: args.shares.map((s) => ({ userId: s.userId, amount: s.cents / 100 })) };
  const recipients = before ? expenseUpdateRecipients(before, after, actorId) : expenseRecipients(after, actorId);
  if (recipients.length === 0) return [];
  const [group, profiles] = await Promise.all([loadGroup(saved.groupId), loadProfiles([actorId])]);
  return expenseEvents({
    kind: before ? "updated" : "added",
    groupId: saved.groupId,
    groupName: group?.name ?? "",
    expenseId: saved.id,
    expense: after,
    recipients,
    actorId,
    actorName: profiles.get(actorId)?.name ?? "",
  });
}

/** A shared expense was deleted (soft delete); `before` was read before the RPC. Settlements are not announced as deleted expenses. */
export async function expenseDeletedEvents(before: StoredExpense | null, actorId: string): Promise<NotifyEvent[]> {
  if (!before || before.kind !== "expense") return [];
  const recipients = expenseRecipients(before, actorId);
  if (recipients.length === 0) return [];
  const [group, profiles] = await Promise.all([loadGroup(before.groupId), loadProfiles([actorId])]);
  return expenseEvents({
    kind: "deleted",
    groupId: before.groupId,
    groupName: group?.name ?? "",
    expenseId: before.id,
    expense: before,
    recipients,
    actorId,
    actorName: profiles.get(actorId)?.name ?? "",
  });
}

export async function settlementSavedEvents(args: { expenseId: string; groupId: string; from: string; to: string; amount: number; actorId: string }): Promise<NotifyEvent[]> {
  const [group, profiles] = await Promise.all([loadGroup(args.groupId), loadProfiles([args.actorId])]);
  return settlementEvents({ ...args, groupName: group?.name ?? "", actorName: profiles.get(args.actorId)?.name ?? "" });
}

/** The members just added to a group (creation or a later add) are told, except the author. */
export async function memberAddedEvents(groupId: string, userIds: readonly string[], actorId: string): Promise<NotifyEvent[]> {
  const recipients = [...new Set(userIds)].filter((id) => id !== actorId);
  if (recipients.length === 0) return [];
  const [group, profiles] = await Promise.all([loadGroup(groupId), loadProfiles([actorId])]);
  const actorName = profiles.get(actorId)?.name ?? "";
  return recipients.map((userId) => ({
    userId,
    type: "shared.member_added" as const,
    actorId,
    entityType: "group",
    entityId: groupId,
    params: { groupId, groupName: group?.name ?? "", actorName },
  }));
}

/** Someone else removed this user from a group. Leaving on your own tells nobody. */
export async function memberRemovedEvents(groupId: string, removedId: string, actorId: string): Promise<NotifyEvent[]> {
  if (removedId === actorId) return [];
  const [group, profiles] = await Promise.all([loadGroup(groupId), loadProfiles([actorId])]);
  return [
    {
      userId: removedId,
      type: "shared.member_removed",
      actorId,
      entityType: "group",
      entityId: groupId,
      params: { groupName: group?.name ?? "", actorName: profiles.get(actorId)?.name ?? "" },
    },
  ];
}

/** The group is gone: the rest of its members (read BEFORE the delete) are told. */
export async function groupDeletedEvents(group: { name: string; memberIds: readonly string[] } | null, groupId: string, actorId: string): Promise<NotifyEvent[]> {
  if (!group) return [];
  const recipients = group.memberIds.filter((id) => id !== actorId);
  if (recipients.length === 0) return [];
  const profiles = await loadProfiles([actorId]);
  const actorName = profiles.get(actorId)?.name ?? "";
  return recipients.map((userId) => ({
    userId,
    type: "shared.group_deleted" as const,
    actorId,
    entityType: "group",
    entityId: groupId,
    params: { groupName: group.name, actorName },
  }));
}
