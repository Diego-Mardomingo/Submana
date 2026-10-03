import { describe, expect, it } from "vitest";
import { metricTransactions, sumByType } from "./metricsFilters";

const tx = (id: string, type: "income" | "expense", amount: number, extra: Record<string, unknown> = {}) => ({
  id,
  type,
  amount,
  date: "2026-10-01T10:00:00Z",
  account_id: "a1",
  ...extra,
});

describe("cuentas conjuntas", () => {
  const joint = new Set(["joint"]);
  const inJoint = tx("j1", "expense", 30, { account_id: "joint" });
  const mine = tx("m1", "expense", 12);

  it("metricTransactions descarta las filas de cuentas conjuntas", () => {
    expect(metricTransactions([inJoint, mine], undefined, { jointAccountIds: joint }).map((t) => t.id)).toEqual(["m1"]);
    expect(metricTransactions([inJoint, mine]).map((t) => t.id)).toEqual(["j1", "m1"]);
  });

  it("mi traspaso hacia la conjunta no tiene pareja y cuenta como gasto mío", () => {
    const out = tx("out", "expense", 50, { account_id: "a1" });
    const arrives = tx("in", "income", 50, { account_id: "joint" });
    expect(metricTransactions([out, arrives], undefined, { jointAccountIds: joint })).toEqual([out]);
    expect(sumByType(metricTransactions([out, arrives], undefined, { jointAccountIds: joint }))).toEqual({ income: 0, expense: 50 });
  });

  it("un traspaso entre cuentas propias sigue emparejándose", () => {
    const out = tx("out", "expense", 50, { account_id: "a1" });
    const incoming = tx("in", "income", 50, { account_id: "a2" });
    expect(metricTransactions([out, incoming], undefined, { jointAccountIds: joint })).toEqual([]);
  });
});
