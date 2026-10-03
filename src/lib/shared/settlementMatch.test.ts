import { describe, expect, it } from "vitest";
import { suggestSettlements, type OwedPair } from "./settlementMatch";

const now = new Date("2026-10-03T12:00:00Z");
const ana: OwedPair = { groupId: "g1", friendId: "ana", displayName: "Ana Garcia", handle: "ana_g", cents: 2000 };
const bob: OwedPair = { groupId: "g2", friendId: "bob", displayName: "Bob", handle: "bobby", cents: -1500 };

describe("suggestSettlements", () => {
  it("ingreso exacto con el nombre en el concepto -> me paga lo que me debe", () => {
    const [s] = suggestSettlements(
      [{ id: "t1", type: "income", amount: 20, date: "2026-10-01T10:00:00Z", description: "Bizum de ANA GARCIA" }],
      [ana, bob],
      now
    );
    expect(s).toMatchObject({ txId: "t1", friendId: "ana", direction: "from_friend", exact: true });
    expect(s!.score).toBeGreaterThan(0.9);
  });

  it("gasto -> pago lo que debo; un ingreso nunca casa con una deuda mía", () => {
    const out = suggestSettlements(
      [
        { id: "t1", type: "expense", amount: 15, date: "2026-10-01T10:00:00Z", description: "Bizum a Bob" },
        { id: "t2", type: "income", amount: 15, date: "2026-10-01T10:00:00Z", description: "Bizum Bob" },
      ],
      [bob],
      now
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ txId: "t1", direction: "to_friend" });
  });

  it("pago parcial puntúa menos y necesita el nombre; mayor que la deuda no casa", () => {
    const partialNamed = suggestSettlements([{ id: "t", type: "income", amount: 10, date: "2026-10-01T10:00:00Z", description: "Ana" }], [ana], now);
    expect(partialNamed[0]?.exact).toBe(false);
    expect(partialNamed[0]!.score).toBeLessThan(0.9);
    expect(suggestSettlements([{ id: "t", type: "income", amount: 10, date: "2026-10-01T10:00:00Z", description: "Pago" }], [ana], now)).toEqual([]);
    expect(suggestSettlements([{ id: "t", type: "income", amount: 25, date: "2026-10-01T10:00:00Z", description: "Ana" }], [ana], now)).toEqual([]);
  });

  it("fuera de la ventana de 60 días no sugiere", () => {
    expect(suggestSettlements([{ id: "t", type: "income", amount: 20, date: "2026-07-01T10:00:00Z", description: "Ana Garcia" }], [ana], now)).toEqual([]);
  });

  it("cada transacción y cada pareja se usan una vez", () => {
    const out = suggestSettlements(
      [
        { id: "t1", type: "income", amount: 20, date: "2026-10-01T10:00:00Z", description: "Ana" },
        { id: "t2", type: "income", amount: 20, date: "2026-10-02T10:00:00Z", description: "Ana Garcia" },
      ],
      [ana],
      now
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.txId).toBe("t2");
  });
});
