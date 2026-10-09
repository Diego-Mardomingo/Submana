import { describe, expect, it, vi } from "vitest";
import { friendRequestAcceptedEvents, friendRequestSentEvents, type FriendshipRow } from "./friends";

// No service-role env in tests: the profile lookup fails quietly and the names come out empty.
vi.spyOn(console, "error").mockImplementation(() => {});

const NOW = Date.parse("2026-10-09T12:00:00Z");
const row = (over: Partial<FriendshipRow> = {}): FriendshipRow => ({ id: "f1", requester_id: "ana", addressee_id: "luis", status: "pending", responded_at: null, ...over });

describe("friendRequestSentEvents", () => {
  it("tells the addressee about a pending request, once per friendship", async () => {
    const [event] = await friendRequestSentEvents(row(), "ana", NOW);
    expect(event).toMatchObject({ userId: "luis", type: "friend.request_received", actorId: "ana", dedupeKey: "friend.request_received:f1" });
  });

  it("tells the original requester when the reverse request was accepted on the spot", async () => {
    const accepted = row({ requester_id: "luis", addressee_id: "ana", status: "accepted", responded_at: new Date(NOW - 1000).toISOString() });
    const [event] = await friendRequestSentEvents(accepted, "ana", NOW);
    expect(event).toMatchObject({ userId: "luis", type: "friend.request_accepted", dedupeKey: "friend.request_accepted:f1" });
  });

  it("stays quiet for an old friendship that was simply returned", async () => {
    const old = row({ requester_id: "luis", addressee_id: "ana", status: "accepted", responded_at: new Date(NOW - 3_600_000).toISOString() });
    expect(await friendRequestSentEvents(old, "ana", NOW)).toEqual([]);
  });

  it("stays quiet for a pending request the other person sent me", async () => {
    expect(await friendRequestSentEvents(row({ requester_id: "luis", addressee_id: "ana" }), "ana", NOW)).toEqual([]);
  });
});

describe("friendRequestAcceptedEvents", () => {
  it("tells the requester when the addressee accepts", async () => {
    const [event] = await friendRequestAcceptedEvents(row({ status: "accepted" }), "luis");
    expect(event).toMatchObject({ userId: "ana", type: "friend.request_accepted", actorId: "luis" });
  });

  it("does nothing for a declined request (the returned row is still pending) or the wrong actor", async () => {
    expect(await friendRequestAcceptedEvents(row(), "luis")).toEqual([]);
    expect(await friendRequestAcceptedEvents(row({ status: "accepted" }), "ana")).toEqual([]);
  });
});
