/**
 * Joint account notification events: invitations, members leaving, deleted accounts and the movements
 * and imports of other members. Recipients are computed here (pure); the loaders read with the service
 * role and never throw. Aggregating several movements of one person is done by `notify()` from the catalog.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotifyEvent } from "../core";
import { euros, loadProfiles } from "./common";

export interface AccountInfo {
  id: string;
  name: string;
  ownerId: string;
  isJoint: boolean;
  /** The owner plus every member who accepted. */
  memberIds: string[];
  /** Status of each row of `account_members` (the owner's own row is `accepted`). */
  statuses: Record<string, "pending" | "accepted">;
}

/** Everyone on the account except the author of the action. */
export const otherMembers = (info: Pick<AccountInfo, "memberIds">, actorId: string) => info.memberIds.filter((id) => id !== actorId);

/** Account, owner and members. Read it BEFORE a member leaves, is removed or the account is deleted. Null on error or when missing. */
export async function loadAccountInfo(accountId: string): Promise<AccountInfo | null> {
  try {
    const admin = createAdminClient();
    const [{ data: account, error }, { data: members, error: membersError }] = await Promise.all([
      admin.from("accounts").select("name, user_id, is_joint").eq("id", accountId).maybeSingle(),
      admin.from("account_members").select("user_id, status").eq("account_id", accountId),
    ]);
    if (error) throw error;
    if (membersError) throw membersError;
    if (!account) return null;
    const statuses: AccountInfo["statuses"] = {};
    for (const m of members ?? []) statuses[m.user_id as string] = m.status as "pending" | "accepted";
    const ownerId = account.user_id as string;
    return {
      id: accountId,
      name: account.name as string,
      ownerId,
      isJoint: !!account.is_joint,
      memberIds: [...new Set([ownerId, ...Object.entries(statuses).filter(([, status]) => status === "accepted").map(([id]) => id)])],
      statuses,
    };
  } catch (error) {
    console.error("[notifications] loadAccountInfo", error);
    return null;
  }
}

const actorNameOf = async (actorId: string) => (await loadProfiles([actorId])).get(actorId)?.name ?? "";

/** The invitee is told. The dedupe key includes when the invitation was made: inviting someone again after a decline is a new notification. */
export async function inviteReceivedEvents(row: { account_id: string; user_id: string; status: string; added_at: string }, actorId: string): Promise<NotifyEvent[]> {
  if (row.status !== "pending") return [];
  const [info, actorName] = await Promise.all([loadAccountInfo(row.account_id), actorNameOf(actorId)]);
  if (!info) return [];
  return [
    {
      userId: row.user_id,
      type: "joint.invite_received",
      actorId,
      entityType: "account",
      entityId: row.account_id,
      params: { accountId: row.account_id, accountName: info.name, actorName },
      dedupeKey: `joint.invite_received:${row.account_id}:${row.user_id}:${row.added_at}`,
    },
  ];
}

/** The owner hears the answer; the other members too when it was accepted. (A decline may turn the account personal again, so the owner comes from `accounts`.) */
export async function inviteAnsweredEvents(accountId: string, accepted: boolean, actorId: string): Promise<NotifyEvent[]> {
  const [info, actorName] = await Promise.all([loadAccountInfo(accountId), actorNameOf(actorId)]);
  if (!info) return [];
  const recipients = accepted ? otherMembers(info, actorId) : [info.ownerId].filter((id) => id !== actorId);
  return recipients.map((userId) => ({
    userId,
    type: "joint.invite_answered" as const,
    actorId,
    entityType: "account",
    entityId: accountId,
    params: { accountId, accountName: info.name, actorName, accepted },
  }));
}

/**
 * A member left (`targetId` is the author: the rest are told) or the owner removed a member (`targetId` is
 * that member: only they are told, and only if they had accepted: cancelling a pending invitation is silent).
 * `info` was read before the RPC, since the cleanup may delete the membership rows.
 */
export async function memberLeftEvents(info: AccountInfo | null, targetId: string, actorId: string): Promise<NotifyEvent[]> {
  if (!info) return [];
  const left = targetId === actorId;
  const recipients = left ? otherMembers(info, actorId) : info.statuses[targetId] === "accepted" ? [targetId] : [];
  if (recipients.length === 0) return [];
  const actorName = await actorNameOf(actorId);
  return recipients.map((userId) => ({
    userId,
    type: "joint.member_left" as const,
    actorId,
    entityType: "account",
    entityId: info.id,
    params: { accountId: info.id, accountName: info.name, actorName, removed: !left },
  }));
}

/** The owner deleted the account: its members (read before) are told. */
export async function accountDeletedEvents(info: AccountInfo | null, actorId: string): Promise<NotifyEvent[]> {
  if (!info) return [];
  const recipients = otherMembers(info, actorId);
  if (recipients.length === 0) return [];
  const actorName = await actorNameOf(actorId);
  return recipients.map((userId) => ({
    userId,
    type: "joint.account_deleted" as const,
    actorId,
    entityType: "account",
    entityId: info.id,
    params: { accountName: info.name, actorName },
  }));
}

export interface TransactionChange {
  accountId: string;
  kind: "added" | "updated" | "deleted";
  tx: { id: string; description?: string | null; amount: number | string };
}

const LABEL_MAX = 60;

/** Short label of a movement for the notification text (empty when it has no description). */
export const transactionLabel = (description?: string | null) => {
  const label = (description ?? "").trim();
  return label.length > LABEL_MAX ? `${label.slice(0, LABEL_MAX - 1)}…` : label;
};

/** Joint-account events of one account's movement change, for every other member (the catalog aggregates them per author and account). */
export function transactionEvents(info: AccountInfo, change: TransactionChange, actorId: string, actorName: string): NotifyEvent[] {
  if (!info.isJoint) return [];
  const label = transactionLabel(change.tx.description);
  return otherMembers(info, actorId).map((userId) => ({
    userId,
    type: "joint.transaction" as const,
    actorId,
    entityType: "account",
    entityId: info.id,
    params: {
      accountId: info.id,
      accountName: info.name,
      actorName,
      count: 1,
      kind: change.kind,
      items: label ? [label] : [],
      // A deleted movement has nothing to open.
      ...(change.kind !== "deleted" && { txId: change.tx.id }),
      amount: euros(change.tx.amount),
    },
  }));
}

/** Movement changes (usually one; an edit that moves a movement between accounts is two) as events, skipping personal accounts. */
export async function jointTransactionEvents(changes: readonly TransactionChange[], actorId: string): Promise<NotifyEvent[]> {
  if (changes.length === 0) return [];
  const accountIds = [...new Set(changes.map((c) => c.accountId))];
  const [infos, actorName] = await Promise.all([Promise.all(accountIds.map(loadAccountInfo)), actorNameOf(actorId)]);
  const byId = new Map(infos.flatMap((info) => (info ? [[info.id, info] as const] : [])));
  return changes.flatMap((change) => {
    const info = byId.get(change.accountId);
    return info ? transactionEvents(info, change, actorId, actorName) : [];
  });
}

/** What an edit of a movement did to the joint account(s) involved. */
export function transactionEditChanges(before: { id: string; account_id: string; description?: string | null; amount: number | string }, after: { account_id: string; description?: string | null; amount: number | string }): TransactionChange[] {
  if (before.account_id === after.account_id) return [{ accountId: after.account_id, kind: "updated", tx: { id: before.id, description: after.description, amount: after.amount } }];
  return [
    { accountId: before.account_id, kind: "deleted", tx: { id: before.id, description: before.description, amount: before.amount } },
    { accountId: after.account_id, kind: "added", tx: { id: before.id, description: after.description, amount: after.amount } },
  ];
}

/** A member imported a statement into a joint account: one notification for the whole import. */
export async function jointImportEvents(accountId: string, imported: number, actorId: string): Promise<NotifyEvent[]> {
  if (imported <= 0) return [];
  const [info, actorName] = await Promise.all([loadAccountInfo(accountId), actorNameOf(actorId)]);
  if (!info?.isJoint) return [];
  return otherMembers(info, actorId).map((userId) => ({
    userId,
    type: "joint.import" as const,
    actorId,
    entityType: "account",
    entityId: accountId,
    params: { accountId, accountName: info.name, actorName, count: imported },
  }));
}

/** Remembers when a statement was last imported into the account (the monthly import reminder reads it). Never throws. */
export async function markAccountImported(accountId: string) {
  try {
    const { error } = await createAdminClient().from("accounts").update({ last_imported_at: new Date().toISOString() }).eq("id", accountId);
    if (error) throw error;
  } catch (error) {
    console.error("[notifications] markAccountImported", error);
  }
}
