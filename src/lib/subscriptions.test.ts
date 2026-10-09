import { afterEach, describe, expect, it, vi } from "vitest";
import { toDateString } from "@/lib/date";
import { chargeDatesBetween, endingNotice, isPaymentDay, isSubscriptionActive, monthlyCost, nextPaymentDate, renewalReminders, totalSpent } from "./subscriptions";

// The Vitest process runs in America/New_York (vitest.config.ts): the app must still think in Madrid.

type Sub = Parameters<typeof chargeDatesBetween>[0] & { reminder_offsets?: number[] | null };
const sub = (over: Partial<Sub> = {}): Sub => ({ start_date: "2026-01-10", end_date: null, frequency: "monthly", frequency_value: 1, reminder_offsets: [1], ...over });
/** Local noon of a day (what the helpers expect as `today`). */
const day = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};
const reminders = (s: Sub, today: string) => renewalReminders(s, day(today)).map((r) => `${r.offset}:${r.chargeDate}`);

afterEach(() => vi.useRealTimers());

describe("Madrid today", () => {
  it("uses the Madrid day, not the process one", () => {
    // 22:30 UTC on Oct 9: still the 9th in New York (18:30), already the 10th in Madrid (00:30).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T22:30:00Z"));
    const monthly = sub({ start_date: "2026-01-10" });
    expect(toDateString(nextPaymentDate(monthly)!)).toBe("2026-11-10");
    expect(isSubscriptionActive(sub({ start_date: "2026-10-10" }))).toBe(true);
    expect(isSubscriptionActive(sub({ start_date: "2026-10-11" }))).toBe(false);
    expect(totalSpent({ ...monthly, cost: 10 })).toBe(100);
  });

  it("an explicit today wins", () => {
    expect(toDateString(nextPaymentDate(sub(), day("2026-10-09"))!)).toBe("2026-10-10");
    expect(toDateString(nextPaymentDate(sub(), day("2026-10-10"))!)).toBe("2026-11-10");
  });
});

describe("renewalReminders", () => {
  it("fires exactly N days before a charge, for each offset", () => {
    const s = sub({ reminder_offsets: [0, 1, 3, 7] });
    expect(reminders(s, "2026-10-03")).toEqual(["7:2026-10-10"]);
    expect(reminders(s, "2026-10-07")).toEqual(["3:2026-10-10"]);
    expect(reminders(s, "2026-10-09")).toEqual(["1:2026-10-10"]);
    expect(reminders(s, "2026-10-10")).toEqual(["0:2026-10-10"]);
    expect(reminders(s, "2026-10-04")).toEqual([]);
  });

  it("sends nothing without offsets and ignores invalid ones", () => {
    expect(reminders(sub({ reminder_offsets: [] }), "2026-10-09")).toEqual([]);
    expect(reminders(sub({ reminder_offsets: null }), "2026-10-09")).toEqual([]);
    expect(reminders(sub({ reminder_offsets: undefined }), "2026-10-09")).toEqual([]);
    expect(reminders(sub({ reminder_offsets: [2, 5] }), "2026-10-08")).toEqual([]);
    expect(reminders(sub({ reminder_offsets: [1, 1] }), "2026-10-09")).toEqual(["1:2026-10-10"]);
  });

  it("clamps charges to the last day of short months", () => {
    const s = sub({ start_date: "2026-01-31", reminder_offsets: [3] });
    expect(reminders(s, "2026-02-25")).toEqual(["3:2026-02-28"]);
    expect(reminders(s, "2026-02-24")).toEqual([]);
    // 2026-03-31 is a normal charge again
    expect(reminders(s, "2026-03-28")).toEqual(["3:2026-03-31"]);
    // leap year
    const leap = sub({ start_date: "2028-01-31", reminder_offsets: [3] });
    expect(reminders(leap, "2028-02-26")).toEqual(["3:2028-02-29"]);
  });

  it("handles weekly subscriptions every N weeks", () => {
    const s = sub({ start_date: "2026-10-01", frequency: "weekly", frequency_value: 2, reminder_offsets: [3, 1] });
    expect(reminders(s, "2026-10-12")).toEqual(["3:2026-10-15"]);
    expect(reminders(s, "2026-10-14")).toEqual(["1:2026-10-15"]);
    // the off week has no charge
    expect(reminders(s, "2026-10-19")).toEqual([]);
    expect(reminders(s, "2026-10-26")).toEqual(["3:2026-10-29"]);
  });

  it("handles subscriptions every N days without drifting like 3 months would", () => {
    const s = sub({ start_date: "2026-01-01", frequency: "daily", frequency_value: 90, reminder_offsets: [1] });
    const charges = chargeDatesBetween(s, day("2026-01-01"), day("2026-12-31")).map(toDateString);
    expect(charges).toEqual(["2026-01-01", "2026-04-01", "2026-06-30", "2026-09-28", "2026-12-27"]);
    expect(reminders(s, "2026-06-29")).toEqual(["1:2026-06-30"]);
    expect(reminders(s, "2026-06-30")).toEqual([]);
    expect(isPaymentDay(s, 2026, 8, 28)).toBe(true);
    expect(isPaymentDay(s, 2026, 9, 1)).toBe(false);
    expect(monthlyCost({ ...s, cost: 30 })).toBeCloseTo((30 * 365) / 12 / 90);
  });

  it("handles every N months and yearly subscriptions", () => {
    const quarterly = sub({ start_date: "2026-01-15", frequency_value: 3, reminder_offsets: [1] });
    expect(reminders(quarterly, "2026-04-14")).toEqual(["1:2026-04-15"]);
    expect(reminders(quarterly, "2026-02-14")).toEqual([]);
    const yearly = sub({ start_date: "2024-02-29", frequency: "yearly", reminder_offsets: [1] });
    expect(reminders(yearly, "2026-02-27")).toEqual(["1:2026-02-28"]);
    expect(reminders(yearly, "2028-02-28")).toEqual(["1:2028-02-29"]);
  });

  it("does not warn about charges after the end date", () => {
    const s = sub({ start_date: "2026-01-15", end_date: "2026-10-15", reminder_offsets: [7] });
    expect(reminders(s, "2026-10-08")).toEqual(["7:2026-10-15"]);
    expect(reminders(s, "2026-11-08")).toEqual([]);
    const earlier = sub({ start_date: "2026-01-15", end_date: "2026-10-14", reminder_offsets: [7] });
    expect(reminders(earlier, "2026-10-08")).toEqual([]);
  });

  it("is not thrown off by the DST changes of Madrid (Oct 25) and New York (Nov 1)", () => {
    const s = sub({ start_date: "2026-10-18", frequency: "weekly", frequency_value: 1, reminder_offsets: [0] });
    for (const charge of ["2026-10-25", "2026-11-01", "2026-11-08"]) expect(reminders(s, charge)).toEqual([`0:${charge}`]);
    const days = chargeDatesBetween(s, day("2026-10-18"), day("2026-11-15")).map(toDateString);
    expect(days).toEqual(["2026-10-18", "2026-10-25", "2026-11-01", "2026-11-08", "2026-11-15"]);
  });
});

describe("endingNotice", () => {
  it("warns 3 days before the end date", () => {
    const s = sub({ start_date: "2026-01-20", end_date: "2026-10-20" });
    expect(endingNotice(s, day("2026-10-17"))).toEqual({ endDate: "2026-10-20", lastCharge: true });
    expect(endingNotice(s, day("2026-10-16"))).toBeNull();
    expect(endingNotice(s, day("2026-10-18"))).toBeNull();
  });

  it("tells a last charge from a plain end", () => {
    const s = sub({ start_date: "2026-01-15", end_date: "2026-10-20" });
    expect(endingNotice(s, day("2026-10-17"))).toEqual({ endDate: "2026-10-20", lastCharge: false });
  });

  it("needs an end date", () => {
    expect(endingNotice(sub(), day("2026-10-17"))).toBeNull();
  });

  it("works across month and year ends", () => {
    const s = sub({ start_date: "2026-01-02", end_date: "2027-01-02" });
    expect(endingNotice(s, day("2026-12-30"))).toEqual({ endDate: "2027-01-02", lastCharge: true });
  });
});
