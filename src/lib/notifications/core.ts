/** Pure notification logic shared by `notify()` and its tests (no DB, no Next). */
import { isTypeEnabled, notificationDef, type MuteTarget, type NotificationParams, type NotificationType } from "./catalog";

type EventOf<T extends NotificationType> = {
  /** Recipient. */
  userId: string;
  type: T;
  /** Who caused it (null/undefined for the cron). A recipient equal to the actor is skipped unless `selfInitiated`. */
  actorId?: string | null;
  entityType?: string;
  entityId?: string;
  params: NotificationParams[T];
  /** Unique per recipient: a repeated event with the same key is ignored (cron reruns). */
  dedupeKey?: string;
  /**
   * The recipient is also the author and the app already showed them a toast: the row is stored as
   * already read (history only: no bell, no push). Without it, an event for the author is dropped.
   */
  selfInitiated?: boolean;
  /** Silence target; defaults to the one the catalog derives from the params (group / joint account). */
  mute?: MuteTarget;
};

/** One notification for one recipient; `params` must match the `type`. */
export type NotifyEvent = { [T in NotificationType]: EventOf<T> }[NotificationType];
export type NotifyEventOf<T extends NotificationType> = EventOf<T>;

export const muteKey = (type: MuteTarget["type"], id: string) => `${type}:${id}`;

/** The group/account whose mute applies to the event, if any. */
export function eventMuteTarget(event: NotifyEvent): MuteTarget | null {
  if (event.mute) return event.mute;
  return notificationDef(event.type).mute?.(event.params) ?? null;
}

/**
 * Drops the events that must not be generated: type turned off by the recipient (decision 7), muted
 * group/account, and events for their own author unless `selfInitiated` (decision 8). System types
 * (push test) are never filtered. A recipient with no settings/mutes entry has everything on.
 * `defaultEnabled` is not consulted: every type is on by default, and `disabled_types` only lists what was turned off.
 */
export function filterEvents(
  events: readonly NotifyEvent[],
  settingsByUser: ReadonlyMap<string, { disabled_types: readonly string[] }>,
  mutesByUser: ReadonlyMap<string, ReadonlySet<string>>
): NotifyEvent[] {
  return events.filter((event) => {
    if (notificationDef(event.type).family === "system") return true;
    if (event.actorId && event.userId === event.actorId && !event.selfInitiated) return false;
    if (!isTypeEnabled(settingsByUser.get(event.userId)?.disabled_types, event.type)) return false;
    const target = eventMuteTarget(event);
    if (target && mutesByUser.get(event.userId)?.has(muteKey(target.type, target.id))) return false;
    return true;
  });
}

/** One event per recipient from a shared template (`userId` is filled in for each). */
export function eventsFor<T extends NotificationType>(userIds: Iterable<string>, event: Omit<EventOf<T>, "userId">): NotifyEvent[] {
  return [...new Set(userIds)].map((userId) => ({ ...event, userId }) as NotifyEvent);
}
