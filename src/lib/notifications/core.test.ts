import { describe, expect, it } from "vitest";
import { eventsFor, filterEvents, muteKey, type NotifyEvent } from "./core";
import { parseSettingsPatch } from "./validation";

const GROUP = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const expenseParams = { groupId: GROUP, groupName: "Piso", expenseId: "e1", title: "Cena", actorName: "Luis", total: 40, share: 10 };
const expense = (userId: string, extra: Partial<NotifyEvent> = {}) =>
  ({ userId, type: "shared.expense_added", actorId: "luis", params: expenseParams, ...extra }) as NotifyEvent;
const txParams = { accountId: ACCOUNT, accountName: "Común", actorName: "Luis", count: 1, kind: "added" as const, items: [] };

const none = new Map<string, { disabled_types: string[] }>();
const noMutes = new Map<string, Set<string>>();

describe("filterEvents", () => {
  it("keeps events when the recipient has no settings", () => {
    expect(filterEvents([expense("ana")], none, noMutes)).toHaveLength(1);
  });

  it("drops types the recipient turned off, only for them", () => {
    const settings = new Map([["ana", { disabled_types: ["shared.expense_added"] }]]);
    const kept = filterEvents([expense("ana"), expense("bea")], settings, noMutes);
    expect(kept.map((e) => e.userId)).toEqual(["bea"]);
    const other = new Map([["ana", { disabled_types: ["shared.settlement"] }]]);
    expect(filterEvents([expense("ana")], other, noMutes)).toHaveLength(1);
  });

  it("drops events of a muted group or account", () => {
    const mutes = new Map([["ana", new Set([muteKey("group", GROUP)])]]);
    expect(filterEvents([expense("ana"), expense("bea")], none, mutes).map((e) => e.userId)).toEqual(["bea"]);

    const tx: NotifyEvent = { userId: "ana", type: "joint.transaction", actorId: "luis", params: txParams };
    const accountMutes = new Map([["ana", new Set([muteKey("account", ACCOUNT)])]]);
    expect(filterEvents([tx], none, accountMutes)).toEqual([]);
    expect(filterEvents([tx], none, mutes)).toHaveLength(1);
  });

  it("lets an explicit mute target win over the derived one", () => {
    const mutes = new Map([["ana", new Set([muteKey("group", "other")])]]);
    expect(filterEvents([expense("ana", { mute: { type: "group", id: "other" } })], none, mutes)).toEqual([]);
    expect(filterEvents([expense("ana")], none, mutes)).toHaveLength(1);
  });

  it("does not mute types without a target, like friend requests", () => {
    const mutes = new Map([["ana", new Set([muteKey("group", GROUP)])]]);
    const event: NotifyEvent = { userId: "ana", type: "friend.request_received", actorId: "luis", params: { actorName: "Luis", handle: "luis" } };
    expect(filterEvents([event], none, mutes)).toHaveLength(1);
  });

  it("skips the author unless the event is self-initiated", () => {
    expect(filterEvents([expense("luis")], none, noMutes)).toEqual([]);
    const own = expense("luis", { selfInitiated: true });
    expect(filterEvents([own], none, noMutes)).toEqual([own]);
  });

  it("still applies disabled types to self-initiated events", () => {
    const settings = new Map([["luis", { disabled_types: ["shared.expense_added"] }]]);
    expect(filterEvents([expense("luis", { selfInitiated: true })], settings, noMutes)).toEqual([]);
  });

  it("keeps events without an actor (cron) and never filters system types", () => {
    const cron: NotifyEvent = { userId: "ana", type: "summary.monthly", params: { month: "2026-09", spent: 1, income: 2, savings: 1, overBudgets: 0 } };
    expect(filterEvents([cron], none, noMutes)).toHaveLength(1);
    const test: NotifyEvent = { userId: "ana", type: "system.push_test", actorId: "ana", params: {} };
    const settings = new Map([["ana", { disabled_types: ["system.push_test"] }]]);
    expect(filterEvents([test], settings, noMutes)).toEqual([test]);
  });
});

describe("eventsFor", () => {
  it("builds one event per distinct recipient", () => {
    const events = eventsFor<"shared.member_removed">(["a", "b", "a"], { type: "shared.member_removed", params: { groupName: "Piso", actorName: "Luis" } });
    expect(events.map((e) => e.userId)).toEqual(["a", "b"]);
    expect(events[0].type).toBe("shared.member_removed");
  });
});

describe("parseSettingsPatch", () => {
  it("accepts partial updates and normalises offsets", () => {
    expect(parseSettingsPatch({ default_renewal_offsets: [7, 1, 1, 0] })).toEqual({ patch: { default_renewal_offsets: [0, 1, 7] } });
    expect(parseSettingsPatch({ default_renewal_offsets: [] })).toEqual({ patch: { default_renewal_offsets: [] } });
    expect(parseSettingsPatch({ lang: "en", summary_day: 28, push_hide_amounts: true, ignored: 1 })).toEqual({
      patch: { lang: "en", summary_day: 28, push_hide_amounts: true },
    });
    expect(parseSettingsPatch({ disabled_types: ["friend.request_received", "friend.request_received"] })).toEqual({
      patch: { disabled_types: ["friend.request_received"] },
    });
    expect(parseSettingsPatch({})).toEqual({ patch: {} });
  });

  it("rejects invalid values", () => {
    for (const body of [
      null,
      { lang: "fr" },
      { disabled_types: ["nope"] },
      { disabled_types: "friend.request_received" },
      { default_renewal_offsets: [2] },
      { default_renewal_offsets: "1" },
      { summary_day: 0 },
      { summary_day: 29 },
      { summary_day: 4.5 },
      { summary_day: "4" },
      { push_hide_amounts: "yes" },
    ]) {
      expect(parseSettingsPatch(body), JSON.stringify(body)).toHaveProperty("error");
    }
  });
});
