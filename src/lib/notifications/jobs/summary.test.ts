import { describe, expect, it } from "vitest";
import { computeMonthlySummary, summaryEvent, summaryUsers, type SummaryCategory, type SummaryTransaction } from "./summary";

describe("summaryUsers", () => {
  const settings = [
    { user_id: "day4", summary_day: 4 },
    { user_id: "day10", summary_day: 10 },
  ];
  const withTransactions = ["day4", "day10", "norow", "norow"];

  it("gives users without a settings row the default day (4)", () => {
    expect(summaryUsers(4, settings, withTransactions)).toEqual(["day4", "norow"]);
  });

  it("picks the users whose chosen day is today", () => {
    expect(summaryUsers(10, settings, withTransactions)).toEqual(["day10"]);
    expect(summaryUsers(5, settings, withTransactions)).toEqual([]);
  });

  it("ignores users without transactions", () => {
    expect(summaryUsers(4, settings, ["day10"])).toEqual([]);
  });
});

const cat = (id: string, name: string, over: Partial<SummaryCategory> = {}): SummaryCategory => ({
  id,
  name,
  name_en: null,
  parent_id: null,
  user_id: null,
  exclude_from_metrics: false,
  ...over,
});
const categories = [
  cat("food", "Comida", { name_en: "Food" }),
  cat("groceries", "Supermercado", { parent_id: "food" }),
  cat("fun", "Ocio"),
  cat("transfers", "Transferencias", { exclude_from_metrics: true }),
];
let n = 0;
const tx = (over: Partial<SummaryTransaction>): SummaryTransaction => ({
  id: `t${++n}`,
  user_id: "u1",
  amount: 10,
  type: "expense",
  date: "2026-09-15T10:00:00Z",
  account_id: "acc1",
  category_id: null,
  subcategory_id: null,
  ...over,
});
const base = { categories, jointAccountIds: ["joint"], budgets: [], budgetLinks: [], lang: "es" as const };

describe("computeMonthlySummary", () => {
  it("adds up expenses, income and savings", () => {
    const summary = computeMonthlySummary({
      ...base,
      transactions: [tx({ amount: "100.10", type: "income" }), tx({ amount: 30.05, category_id: "food" }), tx({ amount: 20, category_id: "fun" })],
    });
    expect(summary).toMatchObject({ spent: 50.05, income: 100.1, savings: 50.05, count: 3, overBudgets: 0 });
  });

  it("leaves out joint accounts, transfers between own accounts and excluded categories", () => {
    const summary = computeMonthlySummary({
      ...base,
      transactions: [
        tx({ amount: 40, category_id: "food" }),
        tx({ amount: 500, account_id: "joint", category_id: "fun" }),
        tx({ amount: 200, category_id: "transfers" }),
        // a transfer between two own accounts: same amount, opposite types, close in time
        tx({ amount: 75, account_id: "acc1", date: "2026-09-20T10:00:00Z" }),
        tx({ amount: 75, type: "income", account_id: "acc2", date: "2026-09-20T10:05:00Z" }),
      ],
    });
    expect(summary).toMatchObject({ spent: 40, income: 0, savings: -40, count: 1 });
  });

  it("finds the top category, grouping subcategories under their parent and using the language", () => {
    const transactions = [
      tx({ amount: 30, category_id: "food", subcategory_id: "groceries" }),
      tx({ amount: 25, subcategory_id: "groceries" }),
      tx({ amount: 50, category_id: "fun" }),
    ];
    expect(computeMonthlySummary({ ...base, transactions }).topCategory).toBe("Comida");
    expect(computeMonthlySummary({ ...base, transactions, lang: "en" }).topCategory).toBe("Food");
    expect(computeMonthlySummary({ ...base, transactions: [tx({ amount: 5 })] }).topCategory).toBeNull();
  });

  it("counts the budgets at or over their limit", () => {
    const transactions = [tx({ amount: 60, category_id: "food" }), tx({ amount: 30, category_id: "fun" })];
    const summary = computeMonthlySummary({
      ...base,
      transactions,
      budgets: [
        { id: "b-food", amount: 50 },
        { id: "b-fun", amount: 100 },
        { id: "b-all", amount: 90 },
        { id: "b-sub", amount: 60 },
      ],
      budgetLinks: [
        { budget_id: "b-food", category_id: "food" },
        { budget_id: "b-fun", category_id: "fun" },
        { budget_id: "b-sub", category_id: "groceries" },
      ],
    });
    // food 60 >= 50 and the general budget 90 >= 90; fun 30 < 100; groceries (sub) 0 < 60
    expect(summary.overBudgets).toBe(2);
  });

  it("has nothing to summarise without transactions that count", () => {
    expect(computeMonthlySummary({ ...base, transactions: [] }).count).toBe(0);
  });
});

describe("summaryEvent", () => {
  it("is deduplicated per month", () => {
    const event = summaryEvent("u1", "2026-09", { spent: 1, income: 2, savings: 1, overBudgets: 0, topCategory: null, count: 3 });
    expect(event).toMatchObject({ userId: "u1", type: "summary.monthly", dedupeKey: "summary.monthly:2026-09" });
    expect(event.params).toEqual({ month: "2026-09", spent: 1, income: 2, savings: 1, overBudgets: 0, topCategory: null });
  });
});
