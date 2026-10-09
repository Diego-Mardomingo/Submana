import { describe, expect, it } from "vitest";
import { ageInDays, dayDiff, dayGroupOf, groupByDay, notificationTimeLabel } from "./inbox";

// Friday 9 Oct 2026, 17:05 in Madrid (CEST, UTC+2). The test process runs in America/New_York.
const NOW = new Date("2026-10-09T15:05:00Z");

describe("dayDiff", () => {
  it("counts whole days, across months and years", () => {
    expect(dayDiff("2026-10-09", "2026-10-09")).toBe(0);
    expect(dayDiff("2026-09-30", "2026-10-01")).toBe(1);
    expect(dayDiff("2025-12-31", "2026-01-01")).toBe(1);
    expect(dayDiff("2026-10-09", "2026-10-02")).toBe(-7);
  });
});

describe("dayGroupOf (Madrid days)", () => {
  it("puts the same Madrid day in today even when the process zone is on the previous day", () => {
    // 00:30 in Madrid on the 9th is still the 8th in New York.
    expect(dayGroupOf("2026-10-08T22:30:00Z", NOW)).toBe("today");
    expect(ageInDays("2026-10-08T22:30:00Z", NOW)).toBe(0);
  });

  it("separates yesterday, the rest of the last 7 days and older", () => {
    expect(dayGroupOf("2026-10-08T21:59:00Z", NOW)).toBe("yesterday"); // 23:59 on the 8th in Madrid
    expect(dayGroupOf("2026-10-03T10:00:00Z", NOW)).toBe("thisWeek"); // 6 days ago
    expect(dayGroupOf("2026-10-02T10:00:00Z", NOW)).toBe("earlier"); // 7 days ago
  });

  it("treats a timestamp slightly in the future as today", () => {
    expect(dayGroupOf("2026-10-09T15:06:00Z", NOW)).toBe("today");
  });
});

describe("groupByDay", () => {
  it("keeps the display order, skips empty groups and keeps the order inside a group", () => {
    const items = [
      { id: "a", created_at: "2026-10-09T14:00:00Z" },
      { id: "b", created_at: "2026-10-09T09:00:00Z" },
      { id: "c", created_at: "2026-09-01T09:00:00Z" },
      { id: "d", created_at: "2026-10-08T12:00:00Z" },
    ];
    const groups = groupByDay(items, NOW);
    expect(groups.map((g) => g.key)).toEqual(["today", "yesterday", "earlier"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("returns nothing for an empty list", () => {
    expect(groupByDay([], NOW)).toEqual([]);
  });
});

describe("notificationTimeLabel", () => {
  it("shows the Madrid time for today and yesterday", () => {
    expect(notificationTimeLabel("2026-10-09T15:00:00Z", "today", "es-ES")).toBe("17:00");
    expect(notificationTimeLabel("2026-10-08T07:05:00Z", "yesterday", "en-GB")).toBe("09:05");
  });

  it("shows a weekday this week and the date for older ones", () => {
    expect(notificationTimeLabel("2026-10-05T10:00:00Z", "thisWeek", "en-US")).toBe("Mon");
    expect(notificationTimeLabel("2026-09-12T10:00:00Z", "earlier", "en-US")).toBe("Sep 12");
  });

  it("is empty for an invalid date", () => {
    expect(notificationTimeLabel("nope", "today", "es-ES")).toBe("");
  });
});
