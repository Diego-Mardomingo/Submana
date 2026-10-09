import { describe, expect, it } from "vitest";
import { isSendHour, madridClock, previousMonth } from "./time";

describe("madridClock", () => {
  it("is 17:00 in Madrid at 15:00 UTC in summer and at 16:00 UTC in winter", () => {
    expect(madridClock(new Date("2026-07-15T15:10:00Z"))).toMatchObject({ date: "2026-07-15", hour: 17 });
    expect(madridClock(new Date("2026-07-15T16:10:00Z")).hour).toBe(18);
    expect(madridClock(new Date("2026-12-15T16:10:00Z"))).toMatchObject({ date: "2026-12-15", hour: 17 });
    expect(madridClock(new Date("2026-12-15T15:10:00Z")).hour).toBe(16);
    expect(isSendHour(madridClock(new Date("2026-07-15T15:59:00Z")))).toBe(true);
    expect(isSendHour(madridClock(new Date("2026-12-15T15:59:00Z")))).toBe(false);
  });

  it("uses the Madrid day even when the process zone (New York) is still on the day before", () => {
    const clock = madridClock(new Date("2026-10-09T22:30:00Z"));
    expect(clock).toMatchObject({ date: "2026-10-10", hour: 0, year: 2026, month: 10, day: 10 });
    expect([clock.today.getFullYear(), clock.today.getMonth(), clock.today.getDate()]).toEqual([2026, 9, 10]);
  });

  it("copes with the clock changes", () => {
    // Madrid goes back on 2026-10-25 at 01:00 UTC
    expect(madridClock(new Date("2026-10-25T15:30:00Z")).hour).toBe(16);
    expect(madridClock(new Date("2026-10-25T16:30:00Z")).hour).toBe(17);
    expect(madridClock(new Date("2026-10-24T15:30:00Z")).hour).toBe(17);
  });
});

describe("previousMonth", () => {
  it("crosses the year", () => {
    expect(previousMonth({ year: 2027, month: 1 })).toEqual({ year: 2026, month: 12, key: "2026-12" });
    expect(previousMonth({ year: 2026, month: 10 })).toEqual({ year: 2026, month: 9, key: "2026-09" });
  });
});
