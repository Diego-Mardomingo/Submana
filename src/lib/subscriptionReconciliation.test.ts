import { describe, expect, it } from "vitest";
import {
  assignMatches,
  bestMatch,
  chargeDateFor,
  chargeHistory,
  lastCharge,
  listStatus,
  monthCharges,
  recentMissedCharges,
  pendingPriceChange,
  priceAt,
  reconciledTotal,
  scoreCandidate,
  type LinkedCharge,
  type MatchableSubscription,
  type MatchableTx,
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

describe("automatic matching", () => {
  const bbva = "acc-bbva";
  const base = (over: Partial<MatchableSubscription>): MatchableSubscription => ({ ...sub(), id: "s", service_name: "x", account_id: bbva, match_pattern: null, ...over });
  const chatgpt = base({ id: "chatgpt", service_name: "ChatGPT Plus", cost: 22.99, start_date: "2026-11-12", price_history: [{ cost: 22.99, valid_from: "2026-11-12" }] });
  const netflix = base({ id: "netflix", service_name: "Netflix", cost: 12.99 });
  const gym = base({ id: "gym", service_name: "Basic-Fit", cost: 29.99, start_date: "2026-09-10", price_history: [{ cost: 29.99, valid_from: "2026-09-10" }] });
  const expense = (id: string, desc: string, amount: number, iso: string, over: Partial<MatchableTx> = {}): MatchableTx => ({ id, type: "expense", amount, date: `${iso}T09:00:00Z`, bank_description: desc, account_id: bbva, ...over });

  it("first ChatGPT charge (dollars, no learned text) waits for confirmation", () => {
    expect(bestMatch([chatgpt], expense("t1", "OPENAI *CHATGPT SUBSCR", 23.04, "2026-11-12"))).toMatchObject({ subscriptionId: "chatgpt", chargeDate: "2026-11-12", kind: "review" });
  });
  it("with the learned bank text the next one links on its own", () => {
    const learned = { ...chatgpt, match_pattern: "OPENAI *CHATGPT SUBSCR" };
    expect(bestMatch([learned], expense("t2", "OPENAI *CHATGPT SUBSCR", 23.1, "2026-12-13"))).toMatchObject({ chargeDate: "2026-12-12", kind: "link" });
  });
  it("a new price still links (the sheet then asks about the price)", () => {
    expect(bestMatch([netflix], expense("t3", "NETFLIX.COM", 13.99, "2026-11-03"))).toMatchObject({ chargeDate: "2026-11-03", kind: "link" });
  });
  it("4 days late is out of the window", () => {
    expect(bestMatch([gym], expense("t4", "BASIC FIT ESPANA SA", 29.99, "2026-11-14"))).toBeNull();
    expect(bestMatch([gym], expense("t5", "BASIC FIT ESPANA SA", 29.99, "2026-11-13"))).toMatchObject({ chargeDate: "2026-11-10", kind: "link" });
  });
  it("needs the same account, an uncovered charge and some evidence", () => {
    expect(bestMatch([netflix], expense("t6", "NETFLIX.COM", 12.99, "2026-11-03", { account_id: "other" }))).toBeNull();
    const covered = { ...netflix, charges: [{ id: "x", amount: 12.99, date: "2026-11-03T09:00:00Z", subscription_charge_date: "2026-11-03" }] };
    expect(bestMatch([covered], expense("t7", "NETFLIX.COM", 12.99, "2026-11-04"))).toBeNull();
    expect(bestMatch([{ ...netflix, skipped_charges: ["2026-11-03"] }], expense("t8", "NETFLIX.COM", 12.99, "2026-11-03"))).toBeNull();
    expect(bestMatch([netflix], expense("t9", "MERCADONA", 30, "2026-11-03"))).toBeNull();
    expect(bestMatch([netflix], expense("t10", "NETFLIX.COM", 12.99, "2026-11-03", { type: "income" }))).toBeNull();
    expect(bestMatch([netflix], expense("t11", "NETFLIX.COM", 12.99, "2026-11-03", { subscription_dismissed_ids: ["netflix"] }))).toBeNull();
  });
  it("exact amount on the day counts as evidence, as a review", () => {
    expect(bestMatch([netflix], expense("t12", "TPV 4471", 12.99, "2026-11-03"))).toMatchObject({ kind: "review" });
  });
  it("a charge of an ended subscription is unexpected, never linked", () => {
    const ended = { ...netflix, end_date: "2026-09-30" };
    expect(bestMatch([ended], expense("t13", "NETFLIX.COM", 12.99, "2026-10-03"))).toMatchObject({ kind: "unexpected", chargeDate: "2026-10-03" });
  });
  it("a batch uses each charge and each transaction once, best first", () => {
    const matches = assignMatches([netflix], [expense("a", "NETFLIX.COM", 12.99, "2026-11-05"), expense("b", "NETFLIX.COM", 12.99, "2026-11-03")]);
    expect(matches).toEqual([expect.objectContaining({ txId: "b", chargeDate: "2026-11-03", kind: "link" })]);
  });
  it("a pending review shows in the history and the list", () => {
    const withReview = { ...chatgpt, reviews: [{ id: "r", amount: 23.04, date: "2026-11-12T09:00:00Z", subscription_review_date: "2026-11-12", bank_description: "OPENAI" }] };
    expect(chargeHistory(withReview, day("2026-11-20"))[1]).toMatchObject({ date: "2026-11-12", status: "review", amount: 23.04 });
    expect(listStatus(withReview, day("2026-11-20"))).toEqual({ kind: "review", date: "2026-11-12" });
  });
});

describe("Home calendar", () => {
  it("places each charge once, linked ones on the day the money moved", () => {
    const spotify = sub({ start_date: "2026-09-05", cost: 10.99, price_history: [{ cost: 10.99, valid_from: "2026-09-05" }], charges: [tx("2026-10-05", 10.99), tx("2026-11-06", 10.99, "2026-11-05")] });
    const nov = monthCharges(spotify, 2026, 11, TODAY);
    expect(nov.map((c) => [c.day, c.charge.status])).toEqual([[6, "paid"]]);
    expect(nov[0].charge.tx?.id).toBe("tx-2026-11-05");
  });
  it("gives past days their real status and future days 'upcoming'", () => {
    const gym = sub({ start_date: "2026-09-10", cost: 29.99, price_history: [{ cost: 29.99, valid_from: "2026-09-10" }], charges: [tx("2026-10-10", 29.99)] });
    expect(monthCharges(gym, 2026, 11, TODAY).map((c) => [c.day, c.charge.status])).toEqual([[10, "missed"]]);
    expect(monthCharges(gym, 2026, 12, TODAY).map((c) => [c.day, c.charge.status])).toEqual([[10, "upcoming"]]);
    const weekly = sub({ start_date: "2026-11-02", frequency: "weekly" });
    expect(monthCharges(weekly, 2026, 11, TODAY).map((c) => [c.day, c.charge.status])).toEqual([[2, "unverified"], [9, "unverified"], [16, "upcoming"], [23, "upcoming"], [30, "upcoming"]]);
  });
  it("shows a changed amount", () => {
    const netflix = sub({ charges: [tx("2026-10-03", 12.99), tx("2026-11-03", 13.99)] });
    expect(monthCharges(netflix, 2026, 11, TODAY)[0].charge).toMatchObject({ status: "changed", amount: 13.99 });
  });
});

describe("recentMissedCharges", () => {
  const gym = sub({ start_date: "2026-08-10", cost: 29.99, price_history: [{ cost: 29.99, valid_from: "2026-08-10" }], charges: [tx("2026-08-10", 29.99)] });
  it("only the ones that turned missed lately", () => {
    // 10 sep and 10 oct missed too, but they are older than the lookback.
    expect(recentMissedCharges(gym, TODAY)).toEqual([{ date: "2026-11-10", expected: 29.99 }]);
    expect(recentMissedCharges(gym, day("2026-11-13"))).toEqual([]);
    expect(recentMissedCharges(gym, day("2026-11-14"))).toEqual([{ date: "2026-11-10", expected: 29.99 }]);
  });
});

describe("Home calendar: charges to confirm", () => {
  it("shows on the day the movement was booked", () => {
    const chat = sub({ start_date: "2026-10-12", cost: 22.99, price_history: [{ cost: 22.99, valid_from: "2026-10-12" }], reviews: [{ id: "r", amount: 23.04, date: "2026-11-13T09:00:00Z", subscription_review_date: "2026-11-12" }] });
    expect(monthCharges(chat, 2026, 11, TODAY).map((c) => [c.day, c.charge.status, c.charge.amount])).toEqual([[13, "review", 23.04]]);
  });
});
