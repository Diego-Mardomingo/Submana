import { describe, expect, it } from "vitest";
import { emptySummary } from "@/lib/subscriptionAutoMatch";
import { missedChargeEvents, type MissedChargeSubscription } from "../jobs/missedCharges";
import { reconcileEvents } from "./subscriptions";

const day = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};

describe("reconcileEvents", () => {
  const summary = {
    ...emptySummary(),
    priceChanges: [{ subscriptionId: "netflix", serviceName: "Netflix", chargeDate: "2026-11-03", charged: 13.99, saved: 12.99 }],
    unexpected: [{ subscriptionId: "disney", serviceName: "Disney+", transactionId: "t1", accountId: "a1", txDate: "2026-10-20", chargeDate: "2026-10-20", amount: 9.99, endDate: "2026-09-30" }],
    reviews: [{ subscriptionId: "chatgpt", serviceName: "ChatGPT Plus", transactionId: "t2", accountId: "a1", txDate: "2026-11-12", chargeDate: "2026-11-12", amount: 23.04, description: "OPENAI" }],
  };

  it("one event per finding with a stable dedupe key", () => {
    expect(reconcileEvents("u1", summary).map((e) => `${e.type}|${e.dedupeKey}`)).toEqual([
      "subscription.price_change|subscription.price_change:netflix:2026-11-03",
      "subscription.unexpected_charge|subscription.unexpected_charge:t1",
      "subscription.match_review|subscription.match_review:t2:chatgpt",
    ]);
  });
  it("rings unless the user started it", () => {
    expect(reconcileEvents("u1", summary).every((e) => !e.selfInitiated && !e.actorId)).toBe(true);
    expect(reconcileEvents("u1", summary, { selfInitiated: true }).every((e) => e.selfInitiated && !e.actorId)).toBe(true);
  });
});

describe("missedChargeEvents", () => {
  const gym: MissedChargeSubscription = {
    id: "gym",
    user_id: "u1",
    service_name: "Basic-Fit",
    start_date: "2026-08-10",
    end_date: null,
    frequency: "monthly",
    frequency_value: 1,
    cost: 29.99,
    skipped_charges: [],
    dismissed_price_charge: null,
    price_history: [{ cost: 29.99, valid_from: "2026-08-10" }],
    charges: [{ id: "t", amount: 29.99, date: "2026-08-10T09:00:00Z", subscription_charge_date: "2026-08-10" }],
  };
  it("notifies the charge that just went missed, once per charge", () => {
    const events = missedChargeEvents([gym], day("2026-11-14"));
    expect(events.map((e) => e.dedupeKey)).toEqual(["subscription.missed_charge:gym:2026-11-10"]);
    expect(events[0].params).toEqual({ subscriptionId: "gym", name: "Basic-Fit", date: "2026-11-10", amount: 29.99 });
  });
  it("nothing within the grace window or once skipped", () => {
    expect(missedChargeEvents([gym], day("2026-11-12"))).toEqual([]);
    expect(missedChargeEvents([{ ...gym, skipped_charges: ["2026-11-10"] }], day("2026-11-14"))).toEqual([]);
  });
});
