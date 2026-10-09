/** Friend request events. Declining, cancelling and unfriending notify nobody, by design. */
import type { NotifyEvent } from "../core";
import { loadProfile } from "./common";

export interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
  responded_at?: string | null;
}

/** A request accepted this recently was accepted by the call that returned it (not an old friendship returned again). */
const FRESH_MS = 15_000;

/** The addressee (the actor) accepted: the requester is told. Declining returns the deleted row, still pending, and notifies nobody. */
export async function friendRequestAcceptedEvents(row: FriendshipRow, actorId: string): Promise<NotifyEvent[]> {
  if (row.status !== "accepted" || row.addressee_id !== actorId) return [];
  const profile = await loadProfile(actorId);
  return [
    {
      userId: row.requester_id,
      type: "friend.request_accepted",
      actorId,
      entityType: "friendship",
      entityId: row.id,
      params: { actorName: profile.name, handle: profile.handle },
      dedupeKey: `friend.request_accepted:${row.id}`,
    },
  ];
}

/**
 * `send_friend_request` returns the friendship it created, the pending one that already existed, or one it
 * accepted on the spot (the other person had already invited me), or an old accepted one. The dedupe key
 * (friendship id) keeps a repeated call from notifying twice.
 */
export async function friendRequestSentEvents(row: FriendshipRow, actorId: string, now = Date.now()): Promise<NotifyEvent[]> {
  if (row.status === "pending") {
    if (row.requester_id !== actorId) return [];
    const profile = await loadProfile(actorId);
    return [
      {
        userId: row.addressee_id,
        type: "friend.request_received",
        actorId,
        entityType: "friendship",
        entityId: row.id,
        params: { actorName: profile.name, handle: profile.handle },
        dedupeKey: `friend.request_received:${row.id}`,
      },
    ];
  }
  const acceptedNow = !!row.responded_at && now - new Date(row.responded_at).getTime() < FRESH_MS;
  return acceptedNow ? friendRequestAcceptedEvents(row, actorId) : [];
}
