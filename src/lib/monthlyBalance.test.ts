import { describe, expect, it } from "vitest";
import { balanceSummary, calendarGrid, historyMonths, monthlyBalances, tintStrength, type MonthBalance } from "./monthlyBalance";

const month = (key: string, income: number, expense: number, hasData = true): MonthBalance => ({ key, income, expense, net: income - expense, hasData });

describe("historyMonths", () => {
  it("goes from the first month with transactions to the current one, gaps included", () => {
    expect(historyMonths(["2026-11", "2026-08", "2026-10"], { year: 2026, month: 11 })).toEqual(["2026-08", "2026-09", "2026-10", "2026-11"]);
  });

  it("crosses years", () => {
    expect(historyMonths(["2025-11"], { year: 2026, month: 2 })).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("ignores months after the current one (scheduled transactions)", () => {
    expect(historyMonths(["2026-11", "2027-01"], { year: 2026, month: 11 })).toEqual(["2026-11"]);
    expect(historyMonths(["2027-01"], { year: 2026, month: 11 })).toEqual([]);
  });

  it("is empty without transactions", () => {
    expect(historyMonths([], { year: 2026, month: 11 })).toEqual([]);
  });
});

describe("monthlyBalances", () => {
  it("adds the result and whether the month had transactions", () => {
    const totals: Record<string, { income: number; expense: number; count: number }> = {
      "2026-10": { income: 2000, expense: 1500, count: 12 },
      "2026-11": { income: 0, expense: 0, count: 0 },
    };
    expect(monthlyBalances(["2026-10", "2026-11"], (key) => totals[key])).toEqual([
      { key: "2026-10", income: 2000, expense: 1500, net: 500, hasData: true },
      { key: "2026-11", income: 0, expense: 0, net: 0, hasData: false },
    ]);
  });
});

describe("balanceSummary", () => {
  it("counts only the months with data", () => {
    const summary = balanceSummary([month("2026-08", 2150, 2790), month("2026-09", 0, 0, false), month("2026-10", 2150, 1650), month("2026-11", 2150, 1150)]);
    expect(summary).toEqual({ total: 860, average: 860 / 3, months: 3, positive: 2, negative: 1, empty: 1 });
  });

  it("is zero without data", () => {
    expect(balanceSummary([])).toEqual({ total: 0, average: 0, months: 0, positive: 0, negative: 0, empty: 0 });
  });

  it("counts a month that broke even as neither positive nor negative", () => {
    expect(balanceSummary([month("2026-11", 100, 100)])).toMatchObject({ positive: 0, negative: 0, months: 1 });
  });
});

describe("tintStrength", () => {
  const months = [month("2026-06", 3000, 1560), month("2026-07", 2150, 2120), month("2026-08", 2150, 2790)];

  it("is 1 for the biggest result, gain or loss", () => {
    expect(tintStrength(1440, months)).toBe(1);
  });

  it("scales the rest against it, with a floor so small months still show", () => {
    expect(tintStrength(-640, months)).toBeCloseTo(640 / 1440);
    expect(tintStrength(30, months)).toBe(0.15);
  });

  it("is 0 for a month that broke even", () => {
    expect(tintStrength(0, months)).toBe(0);
    expect(tintStrength(0, [])).toBe(0);
  });
});

describe("calendarGrid", () => {
  it("pads the history to whole years", () => {
    const cells = calendarGrid(["2025-12", "2026-01", "2026-02"]);
    expect(cells).toHaveLength(24);
    expect(cells[0]).toEqual({ key: "2025-01", year: 2025, month: 1, place: "before" });
    expect(cells[11]).toMatchObject({ key: "2025-12", place: "history" });
    expect(cells[13]).toMatchObject({ key: "2026-02", place: "history" });
    expect(cells[14]).toMatchObject({ key: "2026-03", place: "future" });
  });

  it("is empty without history", () => {
    expect(calendarGrid([])).toEqual([]);
  });
});
