import { describe, expect, it } from "vitest";
import { friendTotals, groupNetBalances, simplifyDebts } from "./debts";

describe("groupNetBalances", () => {
  it("pagado menos debido; las liquidaciones cuentan como gasto", () => {
    const nets = groupNetBalances([
      { paidBy: "a", totalCents: 4000, shares: [{ userId: "a", cents: 2000 }, { userId: "b", cents: 2000 }] },
      { paidBy: "b", totalCents: 2000, shares: [{ userId: "a", cents: 2000 }] }, // b salda 20 a a
    ]);
    expect(Object.fromEntries(nets)).toEqual({ a: 0, b: 0 });
  });
});

describe("simplifyDebts", () => {
  it("un ciclo de 4 se colapsa a nada", () => {
    const pairs = [["a", "b"], ["b", "c"], ["c", "d"], ["d", "a"]] as const;
    const nets = groupNetBalances(
      pairs.map(([payer, debtor]) => ({ paidBy: payer, totalCents: 1000, shares: [{ userId: debtor, cents: 1000 }] }))
    );
    expect(simplifyDebts(nets)).toEqual([]);
  });

  it("todo a cero no genera pagos", () => {
    expect(simplifyDebts({ a: 0, b: 0 })).toEqual([]);
  });

  it("signos mixtos: como mucho n-1 pagos y todo queda saldado", () => {
    const nets = { a: 5000, b: -2000, c: -1500, d: 1000, e: -2500 };
    const transfers = simplifyDebts(nets);
    expect(transfers.length).toBeLessThanOrEqual(4);
    const after: Record<string, number> = { ...nets };
    for (const t of transfers) {
      after[t.from] = after[t.from]! + t.cents;
      after[t.to] = after[t.to]! - t.cents;
    }
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
    expect(transfers[0]).toEqual({ from: "e", to: "a", cents: 2500 });
  });

  it("acepta Map", () => {
    expect(simplifyDebts(new Map([["a", 100], ["b", -100]]))).toEqual([{ from: "b", to: "a", cents: 100 }]);
  });
});

describe("friendTotals", () => {
  it("suma mi posición con cada persona entre grupos", () => {
    const totals = friendTotals("me", [
      { nets: { me: 1000, ana: -1000 } },
      { nets: { me: -300, ana: 300 } },
      { nets: { me: -500, bob: 500 } },
    ]);
    expect(Object.fromEntries(totals.perFriend)).toEqual({ ana: 700, bob: -500 });
    expect(totals.owedToMe).toBe(700);
    expect(totals.iOwe).toBe(500);
  });
});
