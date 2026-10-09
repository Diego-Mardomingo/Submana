import { describe, expect, it } from "vitest";
import { budgetsCrossingWarning, type BudgetWithSpent } from "./useBudgets";

const budget = (id: string, amount: number, spent: number): BudgetWithSpent => ({
  id,
  user_id: "u",
  amount,
  color: null,
  created_at: "",
  updated_at: "",
  categoryIds: [],
  spent,
});

describe("budgetsCrossingWarning", () => {
  it("flags a budget that went from under 80% to 80% or more", () => {
    const crossed = budgetsCrossingWarning([budget("a", 100, 70)], [budget("a", 100, 80)]);
    expect(crossed.map((b) => b.id)).toEqual(["a"]);
  });

  it("flags the jump from 80% to 100%, and one entry when both are crossed at once", () => {
    expect(budgetsCrossingWarning([budget("a", 100, 85)], [budget("a", 100, 100)]).map((b) => b.id)).toEqual(["a"]);
    expect(budgetsCrossingWarning([budget("a", 100, 10)], [budget("a", 100, 130)]).map((b) => b.id)).toEqual(["a"]);
  });

  it("stays quiet when it was already over the threshold or still under it", () => {
    expect(budgetsCrossingWarning([budget("a", 100, 100)], [budget("a", 100, 120)])).toEqual([]);
    expect(budgetsCrossingWarning([budget("a", 100, 85)], [budget("a", 100, 95)])).toEqual([]);
    expect(budgetsCrossingWarning([budget("a", 100, 10)], [budget("a", 100, 79)])).toEqual([]);
  });

  it("checks each budget on its own and ignores empty limits", () => {
    const before = [budget("a", 100, 50), budget("b", 100, 95), budget("c", 0, 0)];
    const after = [budget("a", 100, 81), budget("b", 100, 99), budget("c", 0, 5)];
    expect(budgetsCrossingWarning(before, after).map((b) => b.id)).toEqual(["a"]);
  });

  it("counts a budget missing from the first list from zero", () => {
    expect(budgetsCrossingWarning([], [budget("a", 100, 90)]).map((b) => b.id)).toEqual(["a"]);
  });
});
