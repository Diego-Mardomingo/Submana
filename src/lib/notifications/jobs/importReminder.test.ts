import { describe, expect, it } from "vitest";
import { importReminderEvents, usersToRemind } from "./importReminder";

const now = new Date("2026-10-01T15:10:00Z");

describe("usersToRemind", () => {
  it("only reminds people who have imported before, and not within the last 7 days", () => {
    const accounts = [
      { user_id: "old", last_imported_at: "2026-08-20T10:00:00Z" },
      { user_id: "recent", last_imported_at: "2026-09-28T10:00:00Z" },
      { user_id: "never", last_imported_at: null },
    ];
    expect(usersToRemind(accounts, now)).toEqual(["old"]);
  });

  it("uses the newest import across the user's accounts", () => {
    const accounts = [
      { user_id: "u", last_imported_at: "2026-07-01T10:00:00Z" },
      { user_id: "u", last_imported_at: "2026-09-30T10:00:00Z" },
    ];
    expect(usersToRemind(accounts, now)).toEqual([]);
  });

  it("treats exactly 7 days ago as recent", () => {
    expect(usersToRemind([{ user_id: "u", last_imported_at: "2026-09-24T15:09:00Z" }], now)).toEqual(["u"]);
    expect(usersToRemind([{ user_id: "u", last_imported_at: "2026-09-24T15:10:00Z" }], now)).toEqual([]);
  });
});

describe("importReminderEvents", () => {
  it("asks for last month's statement, once per month", () => {
    const events = importReminderEvents(["a", "b"], { year: 2026, month: 10, day: 1 });
    expect(events.map((e) => [e.userId, e.params, e.dedupeKey])).toEqual([
      ["a", { month: "2026-09" }, "import.reminder:2026-09"],
      ["b", { month: "2026-09" }, "import.reminder:2026-09"],
    ]);
  });

  it("goes back across the year", () => {
    expect(importReminderEvents(["a"], { year: 2027, month: 1, day: 1 })[0].dedupeKey).toBe("import.reminder:2026-12");
  });

  it("only runs on the 1st", () => {
    expect(importReminderEvents(["a"], { year: 2026, month: 10, day: 2 })).toEqual([]);
  });
});
