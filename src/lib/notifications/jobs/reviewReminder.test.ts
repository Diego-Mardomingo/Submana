import { describe, expect, it } from "vitest";
import { madridClock } from "./time";
import { isoWeekday, reviewReminderEvents, type OpenReviewRow } from "./reviewReminder";

// Monday 23 November 2026, 17:00 in Madrid.
const monday = madridClock(new Date("2026-11-23T16:00:00Z"));
const tuesday = madridClock(new Date("2026-11-24T16:00:00Z"));
const open = (user_id: string, description: string, review_reason = "doubt", extra: Partial<OpenReviewRow> = {}): OpenReviewRow => ({
  user_id,
  description,
  review_reason,
  subscription_id: null,
  account: { is_joint: false },
  ...extra,
});

describe("isoWeekday", () => {
  it("counts Monday as 1 and Sunday as 7", () => {
    expect(isoWeekday(monday)).toBe(1);
    expect(isoWeekday(madridClock(new Date("2026-11-22T16:00:00Z")))).toBe(7);
  });
});

describe("reviewReminderEvents", () => {
  it("sends on Mondays by default with one movement waiting, naming up to three merchants", () => {
    const rows = [open("u", "Amazon"), open("u", "La Tasquita"), open("u", "Amazon"), open("u", "Steam"), open("u", "Bizum")];
    expect(reviewReminderEvents(rows, [], monday)).toEqual([
      { userId: "u", type: "review.pending", params: { count: 5, names: ["Amazon", "La Tasquita", "Steam"] }, dedupeKey: "review.pending:2026-11-23" },
    ]);
    expect(reviewReminderEvents([open("u", "Amazon")], [], monday)).toHaveLength(1);
    expect(reviewReminderEvents(rows, [], tuesday)).toEqual([]);
  });

  it("follows each user's day and minimum", () => {
    const settings = [{ user_id: "u", review_mode: "doubt" as const, review_day: 2, review_min: 3 }];
    expect(reviewReminderEvents([open("u", "A"), open("u", "B")], settings, tuesday)).toEqual([]);
    expect(reviewReminderEvents([open("u", "A"), open("u", "B"), open("u", "C")], settings, tuesday)).toHaveLength(1);
    expect(reviewReminderEvents([open("u", "A")], settings, monday)).toEqual([]);
  });

  it("only counts what the deck shows: sure ones and subscription charges need the 'everything' mode", () => {
    const rows = [open("u", "Mercadona", "sure"), open("u", "Netflix", "doubt", { subscription_id: "s" }), open("u", "Joint", "doubt", { account: { is_joint: true } })];
    expect(reviewReminderEvents(rows, [], monday)).toEqual([]);
    const all = [{ user_id: "u", review_mode: "all" as const, review_day: 1, review_min: 1 }];
    expect(reviewReminderEvents(rows, all, monday)[0].params).toEqual({ count: 2, names: ["Mercadona", "Netflix"] });
  });
});
