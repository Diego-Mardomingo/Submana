import { describe, expect, it } from "vitest";
import { buildPushPayload, isGonePushStatus, pushTag } from "./pushPayload";
import type { NotificationRow } from "./types";

const base = { actor_id: null, entity_type: null, entity_id: null, dedupe_key: null, aggregate_key: null, created_at: "2026-10-09T15:00:00Z", read_at: null, user_id: "u1" };

const expense = (over: Partial<NotificationRow> = {}) =>
  ({
    ...base,
    id: "n1",
    type: "shared.expense_added",
    url: "/subcount/g1?expense=e1",
    params: { groupId: "g1", groupName: "Viaje", expenseId: "e1", title: "Cena", actorName: "Ana", total: 42.5, share: 21.25 },
    ...over,
  }) as NotificationRow;

const renewal = (over: Partial<NotificationRow> = {}) =>
  ({
    ...base,
    id: "n2",
    type: "subscription.renewal",
    url: "/subscriptions?sub=s1",
    params: { subscriptionId: "s1", name: "Netflix", amount: 12.99, date: "2026-10-10", daysBefore: 1 },
    ...over,
  }) as NotificationRow;

describe("pushTag", () => {
  it("groups Subcount rows by group", () => {
    expect(pushTag(expense())).toBe("group:g1");
    expect(pushTag(expense({ id: "other" }))).toBe("group:g1");
  });

  it("uses type and aggregate key for aggregated rows", () => {
    const row = { ...base, id: "n3", type: "joint.transaction", url: "/account/a1", aggregate_key: "a1:u2", params: {} } as unknown as NotificationRow;
    expect(pushTag(row)).toBe("joint.transaction:a1:u2");
  });

  it("falls back to the row id", () => {
    expect(pushTag(renewal())).toBe("n2");
  });

  it("does not group Subcount rows that have no group id", () => {
    const row = { ...expense(), type: "shared.group_deleted", params: { groupName: "Viaje", actorName: "Ana" } } as unknown as NotificationRow;
    expect(pushTag(row)).toBe("n1");
  });
});

describe("buildPushPayload", () => {
  it("renders in the recipient's language with the url and tag", () => {
    const es = buildPushPayload(renewal(), "es");
    const en = buildPushPayload(renewal(), "en");
    expect(es).toMatchObject({ url: "/subscriptions?sub=s1", tag: "n2", id: "n2" });
    expect(es.title).not.toBe(en.title);
    expect(es.body).toContain("12,99");
    expect(en.body).toMatch(/12[.,]99/);
  });

  it("hides the amounts when asked", () => {
    const shown = buildPushPayload(expense(), "en");
    const hidden = buildPushPayload(expense(), "en", { hideAmounts: true });
    expect(shown.body).toMatch(/21[.,]25/);
    expect(hidden.body).not.toMatch(/\d+[.,]\d{2}/);
    expect(hidden.body).not.toContain("€");
  });

  it("only keeps internal urls", () => {
    expect(buildPushPayload(renewal({ url: "https://evil.example" }), "en").url).toBe("/notifications");
    expect(buildPushPayload(renewal({ url: null }), "en").url).toBe("/notifications");
  });
});

describe("isGonePushStatus", () => {
  it("is true for 404 and 410 only", () => {
    expect(isGonePushStatus(404)).toBe(true);
    expect(isGonePushStatus(410)).toBe(true);
    expect(isGonePushStatus(429)).toBe(false);
    expect(isGonePushStatus(undefined)).toBe(false);
  });
});
