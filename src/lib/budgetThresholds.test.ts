import { describe, expect, it } from "vitest";
import { budgetRatio, crossedThresholds, mergeCrossedBudgets, reachedThreshold, type CrossedBudget } from "./budgetThresholds";

describe("crossedThresholds", () => {
  it("returns the thresholds passed going up", () => {
    expect(crossedThresholds(0.5, 0.85)).toEqual([0.8]);
    expect(crossedThresholds(0.85, 1.2)).toEqual([1]);
    expect(crossedThresholds(0.5, 1.2)).toEqual([0.8, 1]);
  });

  it("counts landing exactly on a threshold, including float noise", () => {
    expect(crossedThresholds(0.5, 0.8)).toEqual([0.8]);
    expect(0.1 + 0.7).toBeLessThan(0.8); // 0.7999999999999999
    expect(crossedThresholds(0, budgetRatio(0.1 + 0.7, 1))).toEqual([0.8]);
  });

  it("is quiet when already over, still under, or going down", () => {
    expect(crossedThresholds(0.9, 0.95)).toEqual([]);
    expect(crossedThresholds(1.1, 1.5)).toEqual([]);
    expect(crossedThresholds(0.2, 0.79)).toEqual([]);
    expect(crossedThresholds(1.2, 0.5)).toEqual([]);
  });

  it("accepts custom thresholds", () => {
    expect(crossedThresholds(0.4, 0.6, [0.5])).toEqual([0.5]);
  });
});

describe("reachedThreshold", () => {
  it("gives the highest threshold reached", () => {
    expect(reachedThreshold(0.5)).toBeNull();
    expect(reachedThreshold(0.8)).toBe(0.8);
    expect(reachedThreshold(0.99)).toBe(0.8);
    expect(reachedThreshold(1)).toBe(1);
    expect(reachedThreshold(3)).toBe(1);
  });
});

describe("budgetRatio", () => {
  it("is 0 for a budget without a limit", () => {
    expect(budgetRatio(50, 0)).toBe(0);
    expect(budgetRatio(50, 100)).toBe(0.5);
  });
});

describe("mergeCrossedBudgets", () => {
  const crossed = (id: string, pct: number, month = "2026-10"): CrossedBudget => ({ id, name: id, pct, threshold: pct >= 100 ? 100 : 80, month });

  it("keeps the highest crossing per budget and month", () => {
    const merged = mergeCrossedBudgets([crossed("a", 85), crossed("b", 90)], [crossed("a", 110), crossed("a", 82, "2026-09")], undefined);
    expect(merged.map((b) => `${b.id}:${b.month}:${b.pct}`).sort()).toEqual(["a:2026-09:82", "a:2026-10:110", "b:2026-10:90"]);
  });
});
