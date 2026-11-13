import { describe, expect, it } from "vitest";
import { categoryBreakdown, percentChange } from "./categoryBreakdown";

const parentOf = new Map([
  ["rent", "home"],
  ["power", "home"],
  ["super", "food"],
]);

const expense = (amount: number, category_id: string | null, subcategory_id: string | null = null) =>
  ({ amount, type: "expense" as const, category_id, subcategory_id });

describe("categoryBreakdown", () => {
  it("groups expenses by category and subcategory, biggest first", () => {
    const { total, categories } = categoryBreakdown(
      [
        expense(650, "home", "rent"),
        expense(40, "home", "power"),
        expense(32, "home", "power"),
        expense(300, "food", "super"),
        expense(20, "food"),
        { amount: 2000, type: "income", category_id: "salary" },
      ],
      [],
      parentOf
    );
    expect(total).toBe(1042);
    expect(categories.map((c) => [c.id, c.total])).toEqual([
      ["home", 722],
      ["food", 320],
    ]);
    expect(categories[0].subs.map((s) => [s.id, s.total])).toEqual([
      ["rent", 650],
      ["power", 72],
    ]);
    expect(categories[1].subs.map((s) => [s.id, s.total])).toEqual([
      ["super", 300],
      [null, 20],
    ]);
  });

  it("puts rows with only a subcategory under its parent and uncategorised rows under null", () => {
    const { categories } = categoryBreakdown([expense(10, null, "rent"), expense(5, null)], [], parentOf);
    expect(categories.map((c) => [c.id, c.total])).toEqual([
      ["home", 10],
      [null, 5],
    ]);
    expect(categories[0].subs[0].id).toBe("rent");
  });

  it("adds the previous period per category and in total", () => {
    const { previous, categories } = categoryBreakdown(
      [expense(100, "home", "rent")],
      [expense(80, "home", "power"), expense(50, "food")],
      parentOf
    );
    expect(previous).toBe(130);
    expect(categories).toHaveLength(1);
    expect(categories[0].previous).toBe(80);
  });

  it("keeps the names stored on the transaction as a fallback", () => {
    const { categories } = categoryBreakdown(
      [{ ...expense(10, "old", "old-sub"), category: { name: "Old" }, subcategory: { name: "Old sub" } }],
      [],
      new Map()
    );
    expect(categories[0].name).toBe("Old");
    expect(categories[0].subs[0].name).toBe("Old sub");
  });
});

describe("percentChange", () => {
  it("returns null without a previous amount", () => {
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(120, 100)).toBeCloseTo(20);
  });
});
