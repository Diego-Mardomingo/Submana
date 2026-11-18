import { describe, expect, it } from "vitest";
import { monthCounts, pickerYears } from "./monthPicker";

describe("monthCounts", () => {
  it("counts transactions per month in the app's time zone", () => {
    const counts = monthCounts([
      { date: "2026-11-03T10:00:00Z" },
      { date: "2026-11-18T10:00:00Z" },
      // 23:30 UTC on 31 Oct is already 1 Nov in Madrid.
      { date: "2026-10-31T23:30:00Z" },
      { date: "2026-10-05T10:00:00Z" },
    ]);
    expect(Object.fromEntries(counts)).toEqual({ "2026-11": 3, "2026-10": 1 });
  });

  it("skips what the filter leaves out", () => {
    const rows = [
      { date: "2026-11-03T10:00:00Z", account_id: "a" },
      { date: "2026-11-04T10:00:00Z", account_id: "b" },
    ];
    expect(monthCounts(rows, (tx) => tx.account_id === "a").get("2026-11")).toBe(1);
  });
});

describe("pickerYears", () => {
  it("goes from the first year with transactions to the current one", () => {
    const counts = new Map([["2024-03", 4], ["2025-07", 2]]);
    expect(pickerYears(counts, 2026, 2026)).toEqual([2024, 2025, 2026]);
  });

  it("shows only the current year without transactions", () => {
    expect(pickerYears(new Map(), 2026, 2026)).toEqual([2026]);
  });

  it("includes the year being looked at", () => {
    expect(pickerYears(new Map([["2025-01", 1]]), 2027, 2026)).toEqual([2025, 2026, 2027]);
    expect(pickerYears(new Map([["2025-01", 1]]), 2022, 2026)).toEqual([2022, 2023, 2024, 2025, 2026]);
  });
});
