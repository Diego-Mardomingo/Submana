import { describe, expect, it } from "vitest";
import {
  chargeDateFor,
  chargeHistory,
  lastCharge,
  listStatus,
  pendingPriceChange,
  priceAt,
  reconciledTotal,
  scoreCandidate,
  type LinkedCharge,
  type ReconcilableSubscription,
} from "./subscriptionReconciliation";

// The Vitest process runs in America/New_York (vitest.config.ts): days must still be Madrid days.

const day = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};
const TODAY = day("2026-11-15");
/** A transaction booked at 10:00 Madrid on `iso`. */
const tx = (iso: string, amount: number, chargeDate = iso, extra: Partial<LinkedCharge> = {}): LinkedCharge => ({
  id: `tx-${chargeDate}`,
  amount,
  date: `${iso}T09:00:00Z`,
  subscription_charge_date: chargeDate,
  ...extra,
});
const sub = (over: Partial<ReconcilableSubscription> = {}): ReconcilableSubscription => ({
  start_date: "2026-08-03",
  end_date: null,
  frequency: "monthly",
  frequency_value: 1,
  cost: 12.99,
  skipped_charges: [],
  dismissed_price_charge: null,
  price_history: [{ cost: 12.99, valid_from: "2026-08-03" }],
  charges: [],
  ...over,
});
const statuses = (s: ReconcilableSubscription) => chargeHistory(s, TODAY).map((c) => `${c.date}:${c.status}`);

describe("priceAt", () => {
  const history = sub({ price_history: [{ cost: 12.99, valid_from: "2024-02-03" }, { cost: 9.99, valid_from: "2023-03-03" }] });
  it("uses the step in force on that day", () => {
    expect(priceAt(history, "2023-05-03")).toBe(9.99);
    expect(priceAt(history, "2024-02-02")).toBe(9.99);
    expect(priceAt(history, "2024-02-03")).toBe(12.99);
  });
  it("before the first step, the first one; without history, the cost", () => {
    expect(priceAt(history, "2020-01-01")).toBe(9.99);
    expect(priceAt(sub({ price_history: [], cost: 5 }), "2026-01-01")).toBe(5);
  });
});

describe("chargeHistory", () => {
  it("without links nothing is checked: unverified, then pending, then the next one", () => {
    expect(statuses(sub({ start_date: "2026-08-14" }))).toEqual(["2026-12-14:upcoming", "2026-11-14:pending", "2026-10-14:unverified", "2026-09-14:unverified", "2026-08-14:unverified"]);
  });

  it("paid, another amount, and missed once tracking started", () => {
    const s = sub({ charges: [tx("2026-09-04", 12.99, "2026-09-03"), tx("2026-11-03", 13.99)] });
    expect(statuses(s)).toEqual(["2026-12-03:upcoming", "2026-11-03:changed", "2026-10-03:missed", "2026-09-03:paid", "2026-08-03:unverified"]);
    const [, nov, , sep] = chargeHistory(s, TODAY);
    expect(nov.diff).toBe(1);
    expect(sep.bookedOn).toBe("2026-09-04");
    expect(nov.bookedOn).toBeUndefined();
  });

  it("the grace window keeps a late charge pending for 3 days", () => {
    const s = sub({ start_date: "2026-10-12", charges: [tx("2026-10-12", 12.99)] });
    expect(chargeHistory(s, day("2026-11-15"))[1]).toMatchObject({ date: "2026-11-12", status: "pending" });
    expect(chargeHistory(s, day("2026-11-16"))[1]).toMatchObject({ date: "2026-11-12", status: "missed" });
  });

  it("a charge marked as not charged is skipped", () => {
    const s = sub({ charges: [tx("2026-09-03", 12.99)], skipped_charges: ["2026-10-03"] });
    expect(statuses(s)).toContain("2026-10-03:skipped");
  });

  it("compares with the price of that day, not today's", () => {
    const s = sub({ cost: 13.99, price_history: [{ cost: 12.99, valid_from: "2026-08-03" }, { cost: 13.99, valid_from: "2026-11-03" }], charges: [tx("2026-10-03", 12.99), tx("2026-11-03", 13.99)] });
    expect(statuses(s).slice(1, 3)).toEqual(["2026-11-03:paid", "2026-10-03:paid"]);
  });

  it("keeps a link whose date left the schedule", () => {
    const s = sub({ charges: [tx("2026-10-05", 12.99, "2026-10-05")] });
    expect(statuses(s)).toContain("2026-10-05:paid");
  });
});

describe("pendingPriceChange", () => {
  const changed = sub({ charges: [tx("2026-10-03", 12.99), tx("2026-11-03", 13.99)] });
  it("the latest linked charge came for another amount", () => {
    expect(pendingPriceChange(changed, TODAY)).toEqual({ chargeDate: "2026-11-03", charged: 13.99, saved: 12.99, diff: 1 });
  });
  it("gone once ignored for that charge, back with a later one", () => {
    expect(pendingPriceChange({ ...changed, dismissed_price_charge: "2026-11-03" }, TODAY)).toBeNull();
    const later = { ...changed, dismissed_price_charge: "2026-11-03", charges: [...changed.charges!, tx("2026-12-03", 13.99)] };
    expect(pendingPriceChange(later, day("2026-12-05"))?.chargeDate).toBe("2026-12-03");
  });
  it("gone once the price is updated", () => {
    const updated = { ...changed, cost: 13.99, price_history: [...changed.price_history!, { cost: 13.99, valid_from: "2026-11-03" }] };
    expect(pendingPriceChange(updated, TODAY)).toBeNull();
  });
});

describe("listStatus", () => {
  it("one word about the last charge", () => {
    expect(listStatus(sub({ charges: [tx("2026-10-03", 12.99), tx("2026-11-03", 13.99)] }), TODAY)).toEqual({ kind: "price", charged: 13.99 });
    expect(listStatus(sub({ charges: [tx("2026-11-03", 12.99)] }), TODAY)).toEqual({ kind: "paid", date: "2026-11-03" });
    expect(listStatus(sub({ charges: [tx("2026-09-03", 12.99)] }), TODAY)).toEqual({ kind: "missed", date: "2026-11-03" });
    expect(listStatus(sub({ start_date: "2026-08-14" }), TODAY)).toEqual({ kind: "pending", date: "2026-11-14" });
    expect(listStatus(sub(), TODAY)).toBeNull();
  });
  it("nothing for a subscription that ended", () => {
    expect(listStatus(sub({ end_date: "2026-10-30", charges: [tx("2026-10-03", 12.99)] }), TODAY)).toBeNull();
  });
});

describe("reconciledTotal", () => {
  it("real amounts, the price of the day for unchecked charges, nothing for missed or skipped", () => {
    const s = sub({ charges: [tx("2026-09-03", 12.99), tx("2026-11-03", 13.99)], skipped_charges: [] });
    // Aug unverified 12.99 + Sep 12.99 + Oct missed 0 + Nov 13.99
    expect(reconciledTotal(s, TODAY)).toEqual({ total: 39.97, linked: 2, estimated: 1 });
    expect(reconciledTotal({ ...s, skipped_charges: ["2026-08-03"] }, TODAY).total).toBe(26.98);
  });
});

describe("lastCharge / chargeDateFor", () => {
  it("the last due charge, not the next one", () => {
    expect(lastCharge(sub(), TODAY)?.date).toBe("2026-11-03");
  });
  it("the scheduled charge closest to a day", () => {
    expect(chargeDateFor(sub(), "2026-11-06")).toBe("2026-11-03");
    expect(chargeDateFor(sub(), "2026-11-30")).toBe("2026-12-03");
    expect(chargeDateFor(sub({ start_date: "2027-01-01" }), "2026-11-06")).toBeNull();
  });
});

describe("scoreCandidate", () => {
  const gym = { ...sub({ cost: 29.99, price_history: [] }), service_name: "Basic-Fit", match_pattern: null };
  const candidate = (description: string, amount: number, iso: string) => ({ id: description, amount, type: "expense", date: `${iso}T09:00:00Z`, bank_description: description });
  it("ranks the gym first and says why the others are offered", () => {
    const fit = scoreCandidate(gym, candidate("BASIC FIT ESPANA SA", 29.99, "2026-11-14"), "2026-11-10");
    const bizum = scoreCandidate(gym, candidate("BIZUM A LAURA G", 30, "2026-11-11"), "2026-11-10");
    expect(fit.reason).toBe("strong");
    expect(bizum.reason).toBe("amount");
    expect(fit.score).toBeGreaterThan(bizum.score);
  });
  it("uses the learned bank text before the name", () => {
    const chat = { ...gym, cost: 22.99, service_name: "ChatGPT Plus", match_pattern: "OPENAI *CHATGPT SUBSCR" };
    expect(scoreCandidate(chat, candidate("OPENAI *CHATGPT SUBSCR", 23.04, "2026-11-12"), "2026-11-12").reason).toBe("strong");
  });
});
