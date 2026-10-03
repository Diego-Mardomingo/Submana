import { describe, expect, it } from "vitest";
import { metricAmount, metricTransactions, netBalanceChange, sumByType, sumMetricsByType } from "./metricsFilters";

const tx = (id: string, type: "income" | "expense", amount: number, extra: Record<string, unknown> = {}) => ({
  id,
  type,
  amount,
  date: "2026-10-01T10:00:00Z",
  account_id: "a1",
  ...extra,
});

describe("metricAmount", () => {
  it("usa metric_amount cuando existe y el importe si es null/ausente", () => {
    expect(metricAmount({ amount: 40, metric_amount: 20 })).toBe(20);
    expect(metricAmount({ amount: 40, metric_amount: null })).toBe(40);
    expect(metricAmount({ amount: "40.50" })).toBe(40.5);
    expect(metricAmount({ amount: 20, metric_amount: "0" })).toBe(0);
  });
});

describe("métricas con gastos compartidos", () => {
  const split = tx("split", "expense", 40, { metric_amount: 20, shared_expense_id: "e1" });
  const virtual = tx("virtual", "expense", 20, { account_id: null, source: "shared", shared_expense_id: "e2" });
  const settlement = tx("settle", "income", 20, { metric_amount: 0, shared_expense_id: "e3", account_id: "a2" });

  it("metricTransactions descarta importe métrico 0 (liquidaciones) y conserva virtuales", () => {
    expect(metricTransactions([split, virtual, settlement]).map((t) => t.id)).toEqual(["split", "virtual"]);
  });

  it("sumMetricsByType cuenta mi parte; sumByType sigue con el importe del banco", () => {
    expect(sumMetricsByType([split, virtual])).toEqual({ income: 0, expense: 40 });
    expect(sumByType([split, virtual])).toEqual({ income: 0, expense: 60 });
  });

  it("las filas de un gasto compartido no forman traspasos", () => {
    const out = tx("out", "expense", 20, { account_id: "a1", shared_expense_id: "e9" });
    const incoming = tx("in", "income", 20, { account_id: "a2", shared_expense_id: "e9" });
    expect(metricTransactions([out, incoming]).map((t) => t.id)).toEqual(["out", "in"]);
  });

  it("netBalanceChange ignora las filas virtuales (no tienen cuenta)", () => {
    expect(netBalanceChange([split, virtual])).toBe(-40);
  });
});
