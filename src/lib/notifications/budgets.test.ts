import { describe, expect, it } from "vitest";
import { budgetLabel, budgetThresholdEvents, crossedBudgets, monthsOf, type BudgetStatus } from "./budgets";

const status = (budgetId: string, spent: number, limit = 100, month = "2026-10", name = ""): BudgetStatus => ({ budgetId, month, name, spent, limit });

describe("monthsOf", () => {
  const now = new Date("2026-10-15T12:00:00Z");

  it("keeps the recent months once, newest first", () => {
    expect(monthsOf(["2026-09-03T10:00:00Z", "2026-10-02T10:00:00Z", "2026-10-09T10:00:00Z", "2026-08-30T10:00:00Z"], now)).toEqual(["2026-10", "2026-09", "2026-08"]);
  });

  it("drops months older than two back and bad dates", () => {
    expect(monthsOf(["2026-07-31T10:00:00Z", "2025-01-10T10:00:00Z", "nonsense"], now)).toEqual([]);
  });

  it("uses the Madrid month, not UTC", () => {
    // 2026-09-30 23:30 UTC is already October 1st in Madrid.
    expect(monthsOf(["2026-09-30T23:30:00Z"], now)).toEqual(["2026-10"]);
  });
});

describe("budgetThresholdEvents", () => {
  it("emits one self-initiated event per budget at the highest threshold reached", () => {
    const events = budgetThresholdEvents("u1", [status("a", 50), status("b", 85, 100, "2026-10", "Food"), status("c", 130), status("d", 10, 0)]);
    expect(events.map((e) => [e.entityId, e.type === "budget.threshold" && e.params.threshold])).toEqual([
      ["b", 80],
      ["c", 100],
    ]);
    const [first] = events;
    expect(first).toMatchObject({ userId: "u1", actorId: "u1", selfInitiated: true, dedupeKey: "budget.threshold:b:2026-10:80" });
    expect(first.type === "budget.threshold" && first.params).toMatchObject({ name: "Food", spent: 85, limit: 100, month: "2026-10" });
  });
});

describe("crossedBudgets", () => {
  it("reports only budgets that crossed a threshold between the snapshots", () => {
    const before = [status("a", 70), status("b", 90), status("c", 100), status("d", 70, 100, "2026-09")];
    const after = [status("a", 83), status("b", 110), status("c", 120), status("d", 75, 100, "2026-09")];
    expect(crossedBudgets(before, after)).toEqual([
      { id: "a", name: "", pct: 83, threshold: 80, month: "2026-10" },
      { id: "b", name: "", pct: 110, threshold: 100, month: "2026-10" },
    ]);
  });

  it("counts a budget missing from the first snapshot from zero", () => {
    expect(crossedBudgets([], [status("a", 150)])).toEqual([{ id: "a", name: "", pct: 150, threshold: 100, month: "2026-10" }]);
  });
});

describe("budgetLabel", () => {
  const categories = new Map([
    ["food", { id: "food", name: "Comida", name_en: "Food", parent_id: null }],
    ["groceries", { id: "groceries", name: "Supermercado", name_en: "Groceries", parent_id: "food" }],
    ["fun", { id: "fun", name: "Ocio", name_en: null, parent_id: null }],
  ]);

  it("joins the distinct top-level categories in the language", () => {
    expect(budgetLabel(["groceries", "food", "fun"], categories, "es")).toBe("Comida, Ocio");
    expect(budgetLabel(["groceries", "fun"], categories, "en")).toBe("Food, Ocio");
  });

  it("is empty for the general budget", () => {
    expect(budgetLabel([], categories, "es")).toBe("");
  });
});
