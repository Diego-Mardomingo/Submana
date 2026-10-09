import { describe, expect, it } from "vitest";
import { filterEvents } from "../core";
import { otherMembers, transactionEditChanges, transactionEvents, transactionLabel, type AccountInfo } from "./joint";

const info = (over: Partial<AccountInfo> = {}): AccountInfo => ({
  id: "acc",
  name: "Cuenta común",
  ownerId: "ana",
  isJoint: true,
  memberIds: ["ana", "luis", "eva"],
  statuses: { ana: "accepted", luis: "accepted", eva: "accepted" },
  ...over,
});

describe("otherMembers", () => {
  it("is the owner and the accepted members minus the author", () => {
    expect(otherMembers(info(), "luis")).toEqual(["ana", "eva"]);
  });
});

describe("transactionEvents", () => {
  const change = { accountId: "acc", kind: "added" as const, tx: { id: "t1", description: "Supermercado", amount: "42.50" } };

  it("builds one joint.transaction per other member with what the catalog needs", () => {
    const events = transactionEvents(info(), change, "luis", "Luis");
    expect(events.map((e) => e.userId)).toEqual(["ana", "eva"]);
    expect(events[0]).toMatchObject({
      type: "joint.transaction",
      actorId: "luis",
      entityId: "acc",
      params: { accountId: "acc", accountName: "Cuenta común", actorName: "Luis", count: 1, kind: "added", items: ["Supermercado"], txId: "t1", amount: 42.5 },
    });
  });

  it("drops the open-this-movement id when it was deleted", () => {
    const [event] = transactionEvents(info(), { ...change, kind: "deleted" }, "luis", "Luis");
    expect(event.type === "joint.transaction" && event.params).not.toHaveProperty("txId");
  });

  it("is empty for an account that is not joint (or became personal)", () => {
    expect(transactionEvents(info({ isJoint: false }), change, "luis", "Luis")).toEqual([]);
  });

  it("never reaches the author, and a muted account stays silent", () => {
    const events = transactionEvents(info(), change, "luis", "Luis");
    const kept = filterEvents(events, new Map(), new Map([["eva", new Set(["account:acc"])]]));
    expect(kept.map((e) => e.userId)).toEqual(["ana"]);
  });

  it("has no items for a movement without description", () => {
    const [event] = transactionEvents(info(), { ...change, tx: { id: "t1", description: null, amount: 5 } }, "luis", "Luis");
    expect(event.type === "joint.transaction" && event.params.items).toEqual([]);
  });
});

describe("transactionLabel", () => {
  it("trims and shortens long descriptions", () => {
    expect(transactionLabel("  Cena  ")).toBe("Cena");
    expect(transactionLabel(null)).toBe("");
    expect(transactionLabel("x".repeat(100))).toHaveLength(60);
  });
});

describe("transactionEditChanges", () => {
  const before = { id: "t", account_id: "a", description: "Antes", amount: 10 };

  it("is one update when the account stays", () => {
    expect(transactionEditChanges(before, { account_id: "a", description: "Después", amount: 12 })).toEqual([
      { accountId: "a", kind: "updated", tx: { id: "t", description: "Después", amount: 12 } },
    ]);
  });

  it("is a delete in the old account and an add in the new one when it moves", () => {
    const changes = transactionEditChanges(before, { account_id: "b", description: "Antes", amount: 10 });
    expect(changes.map((c) => [c.accountId, c.kind])).toEqual([
      ["a", "deleted"],
      ["b", "added"],
    ]);
  });
});
