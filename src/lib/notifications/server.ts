/**
 * Notification generation (server only). Call `notifyAfter(...)` from route handlers: it runs after the
 * response, filters by the recipients' settings and mutes, stores the rows with the service role
 * and sends the push. Nothing here ever throws: a failed notification must not break the user's action.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificationDef } from "./catalog";
import { filterEvents, muteKey, type NotifyEvent } from "./core";
import { sendPush } from "./push";
import { loadNotificationSettings } from "./settings";
import { NOTIFICATION_COLUMNS, type NotificationRow } from "./types";

export { eventsFor, filterEvents, muteKey, type NotifyEvent, type NotifyEventOf } from "./core";
export { mergeAggregate } from "./catalog";
export { getUserLang, loadNotificationSettings } from "./settings";
export type { NotificationRow } from "./types";

const log = (context: string, error: unknown) => console.error(`[notifications] ${context}`, error);

/** Events of one recipient and aggregation bucket, merged while still in memory (`event` is the first one). */
type AggregateGroup = { event: NotifyEvent; params: NotifyEvent["params"]; key: string };

async function loadMutes(admin: SupabaseClient, userIds: string[]) {
  const mutes = new Map<string, Set<string>>();
  const { data, error } = await admin.from("notification_mutes").select("user_id, target_type, target_id").in("user_id", userIds);
  if (error) throw error;
  for (const row of data ?? []) {
    const set = mutes.get(row.user_id) ?? new Set<string>();
    set.add(muteKey(row.target_type, row.target_id));
    mutes.set(row.user_id, set);
  }
  return mutes;
}

function rowValues(event: NotifyEvent, params: NotifyEvent["params"], aggregateKey: string | null, now: string) {
  return {
    user_id: event.userId,
    type: event.type,
    actor_id: event.actorId ?? null,
    entity_type: event.entityType ?? null,
    entity_id: event.entityId ?? null,
    params,
    url: notificationDef(event.type).url(params),
    dedupe_key: event.dedupeKey ?? null,
    aggregate_key: aggregateKey,
    // Self-initiated: history only (read and seen), so no bell and no push.
    read_at: event.selfInitiated ? now : null,
  };
}

/** Folds events of the same recipient/type/aggregate key into one, using the type's merge. */
function groupAggregates(events: NotifyEvent[]) {
  const groups = new Map<string, AggregateGroup>();
  const rest: NotifyEvent[] = [];
  for (const event of events) {
    const aggregate = notificationDef(event.type).aggregate;
    const key = !event.selfInitiated && aggregate ? aggregate.key({ actorId: event.actorId, params: event.params }) : null;
    if (!aggregate || key == null) {
      rest.push(event);
      continue;
    }
    const id = `${event.userId}|${event.type}|${key}`;
    const group = groups.get(id);
    groups.set(id, { event: group?.event ?? event, key, params: group ? aggregate.merge(group.params, event.params) : event.params });
  }
  return { groups: [...groups.values()], rest };
}

/** Merges into a recent unread notification of the same bucket (bumping it), or returns null to insert a new one. */
async function mergeIntoExisting(admin: SupabaseClient, group: AggregateGroup, now: string) {
  const { event, key, params } = group;
  const aggregate = notificationDef(event.type).aggregate;
  if (!aggregate) return null;
  const since = new Date(Date.now() - aggregate.windowMs).toISOString();
  const { data: existing, error } = await admin
    .from("notifications")
    .select("id, params")
    .eq("user_id", event.userId)
    .eq("type", event.type)
    .eq("aggregate_key", key)
    .is("read_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!existing) return null;

  const merged = aggregate.merge(existing.params, params);
  const { data: updated, error: updateError } = await admin
    .from("notifications")
    .update({ params: merged, url: notificationDef(event.type).url(merged), created_at: now })
    .eq("id", existing.id)
    .is("read_at", null)
    .select(NOTIFICATION_COLUMNS)
    .maybeSingle();
  if (updateError) throw updateError;
  return (updated as NotificationRow | null) ?? null;
}

/**
 * Generates the notifications: filters (disabled type, muted target, author), aggregates, stores and
 * pushes. Resolves once everything is done; never rejects.
 */
export async function notify(events: NotifyEvent[]): Promise<void> {
  try {
    if (events.length === 0) return;
    const admin = createAdminClient();
    const recipients = [...new Set(events.map((e) => e.userId))];
    const [settings, mutes] = await Promise.all([loadNotificationSettings(recipients, admin), loadMutes(admin, recipients)]);
    const kept = filterEvents(events, settings, mutes);
    if (kept.length === 0) return;

    const now = new Date().toISOString();
    const pushRows: NotificationRow[] = [];

    // Push-only types (the test notification) are not stored: they only get a throwaway row to render the push from.
    for (const event of kept) {
      if (notificationDef(event.type).inbox) continue;
      pushRows.push({ ...rowValues(event, event.params, null, now), id: crypto.randomUUID(), created_at: now, read_at: null } as NotificationRow);
    }

    const { groups, rest } = groupAggregates(kept.filter((event) => notificationDef(event.type).inbox));
    const inserts = rest.map((event) => rowValues(event, event.params, null, now));
    for (const group of groups) {
      try {
        const updated = await mergeIntoExisting(admin, group, now);
        if (updated) pushRows.push(updated);
        else inserts.push(rowValues(group.event, group.params, group.key, now));
      } catch (error) {
        log("aggregate", error);
      }
    }

    if (inserts.length > 0) {
      // Rows that hit an existing (user_id, dedupe_key) are ignored and not returned, so they are not pushed again.
      const { data, error } = await admin
        .from("notifications")
        .upsert(inserts, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
        .select(NOTIFICATION_COLUMNS);
      if (error) log("insert", error);
      else pushRows.push(...((data ?? []) as NotificationRow[]));
    }

    const toPush = pushRows.filter((row) => row.read_at == null && notificationDef(row.type).push);
    if (toPush.length > 0) await sendPush(toPush);
  } catch (error) {
    log("notify", error);
  }
}

type EventSource = NotifyEvent | NotifyEvent[] | null | undefined;

/**
 * `notify` after the response is sent (`after()`), so the user's request is not delayed. Pass a function
 * to also compute the recipients (DB reads) after the response; for deletions read them BEFORE the
 * action and pass them in. Never throws.
 */
export function notifyAfter(source: EventSource | (() => EventSource | Promise<EventSource>)) {
  const run = async () => {
    try {
      const resolved = typeof source === "function" ? await source() : source;
      if (resolved) await notify(Array.isArray(resolved) ? resolved : [resolved]);
    } catch (error) {
      log("notifyAfter", error);
    }
  };
  try {
    after(run);
  } catch {
    // Outside a request scope (scripts, tests): just run it in the background.
    void run();
  }
}

/** Ids of everyone in a Subcount group (service role: works after the caller lost access or the group is being deleted). */
export async function loadGroupMemberIds(groupId: string): Promise<string[]> {
  try {
    const { data, error } = await createAdminClient().from("group_members").select("user_id").eq("group_id", groupId);
    if (error) throw error;
    return (data ?? []).map((row) => row.user_id as string);
  } catch (error) {
    log("loadGroupMemberIds", error);
    return [];
  }
}

/** Ids of everyone on an account: the owner plus the members who accepted (service role). */
export async function loadAccountMemberIds(accountId: string): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const [{ data: account, error }, { data: members, error: membersError }] = await Promise.all([
      admin.from("accounts").select("user_id").eq("id", accountId).maybeSingle(),
      admin.from("account_members").select("user_id").eq("account_id", accountId).eq("status", "accepted"),
    ]);
    if (error) throw error;
    if (membersError) throw membersError;
    return [...new Set([...(account ? [account.user_id as string] : []), ...(members ?? []).map((row) => row.user_id as string)])];
  } catch (error) {
    log("loadAccountMemberIds", error);
    return [];
  }
}
