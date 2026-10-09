import { describe, expect, it } from "vitest";
import { renewalEvents, type SubscriptionRow } from "./renewals";

const sub = (over: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
  id: "s1",
  user_id: "u1",
  service_name: "Netflix",
  cost: "12.99",
  start_date: "2026-01-10",
  end_date: null,
  frequency: "monthly",
  frequency_value: 1,
  reminder_offsets: [1],
  ...over,
});
const day = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};
const summary = (subs: SubscriptionRow[], today: string) => renewalEvents(subs, day(today)).map((e) => `${e.type}|${e.userId}|${e.dedupeKey}`);

describe("renewalEvents", () => {
  it("creates a renewal per matching offset with a stable dedupe key", () => {
    const s = sub({ reminder_offsets: [0, 1, 3, 7] });
    expect(summary([s], "2026-10-09")).toEqual(["subscription.renewal|u1|subscription.renewal:s1:2026-10-10:1"]);
    expect(summary([s], "2026-10-09")).toEqual(summary([s], "2026-10-09"));
    expect(summary([s], "2026-10-03")).toEqual(["subscription.renewal|u1|subscription.renewal:s1:2026-10-10:7"]);
  });

  it("copies the data the text needs", () => {
    const [event] = renewalEvents([sub()], day("2026-10-09"));
    expect(event).toMatchObject({
      type: "subscription.renewal",
      entityType: "subscription",
      entityId: "s1",
      params: { subscriptionId: "s1", name: "Netflix", amount: 12.99, date: "2026-10-10", daysBefore: 1 },
    });
  });

  it("skips subscriptions without reminders and days without a charge", () => {
    expect(summary([sub({ reminder_offsets: [] })], "2026-10-09")).toEqual([]);
    expect(summary([sub()], "2026-10-12")).toEqual([]);
  });

  it("sends the ending notice even without reminders, and skips the 3-day renewal of the last charge", () => {
    const last = sub({ start_date: "2026-01-20", end_date: "2026-10-20", reminder_offsets: [3, 1] });
    expect(summary([last], "2026-10-17")).toEqual(["subscription.ending|u1|subscription.ending:s1:2026-10-20"]);
    expect(summary([last], "2026-10-19")).toEqual(["subscription.renewal|u1|subscription.renewal:s1:2026-10-20:1"]);
    const plain = sub({ start_date: "2026-01-15", end_date: "2026-10-20", reminder_offsets: [] });
    const [ending] = renewalEvents([plain], day("2026-10-17"));
    expect(ending).toMatchObject({ type: "subscription.ending", params: { date: "2026-10-20", lastCharge: false } });
  });

  it("handles several users", () => {
    const events = renewalEvents([sub(), sub({ id: "s2", user_id: "u2", service_name: "Spotify" })], day("2026-10-09"));
    expect(events.map((e) => e.userId)).toEqual(["u1", "u2"]);
  });
});
