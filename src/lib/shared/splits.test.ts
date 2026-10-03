import { describe, expect, it } from "vitest";
import { computeShares } from "./splits";

const ids = ["a", "b", "c"];
const cents = (r: ReturnType<typeof computeShares>) => (r.ok ? Object.fromEntries(r.shares.map((s) => [s.userId, s.cents])) : r);

describe("computeShares", () => {
  it("10 € entre 3: el pagador absorbe el céntimo sobrante", () => {
    const r = computeShares(1000, "equal", ids.map((userId) => ({ userId })), "b");
    expect(cents(r)).toEqual({ a: 333, b: 334, c: 333 });
  });

  it("el resultado no depende del orden de entrada", () => {
    const a = computeShares(1000, "equal", ids.map((userId) => ({ userId })), null);
    const b = computeShares(1000, "equal", [...ids].reverse().map((userId) => ({ userId })), null);
    expect(cents(a)).toEqual(cents(b));
    expect(cents(a)).toEqual({ a: 334, b: 333, c: 333 });
  });

  it("40 € entre 2 son 20/20", () => {
    expect(cents(computeShares(4000, "equal", [{ userId: "a" }, { userId: "b" }], "a"))).toEqual({ a: 2000, b: 2000 });
  });

  it("porcentajes: mayor resto y siempre suma el total", () => {
    const r = computeShares(1000, "percent", [
      { userId: "a", value: 33.33 },
      { userId: "b", value: 33.33 },
      { userId: "c", value: 33.34 },
    ]);
    expect(r.ok && r.shares.reduce((s, x) => s + x.cents, 0)).toBe(1000);
  });

  it("porcentajes que no suman 100 se normalizan al total", () => {
    const r = computeShares(1000, "percent", [
      { userId: "a", value: 30 },
      { userId: "b", value: 30 },
    ]);
    expect(cents(r)).toEqual({ a: 500, b: 500 });
  });

  it("shares: reparto proporcional a los pesos", () => {
    const r = computeShares(1000, "shares", [
      { userId: "a", value: 1 },
      { userId: "b", value: 2 },
    ]);
    expect(cents(r)).toEqual({ a: 333, b: 667 });
  });

  it("un peso 0 no recibe nada", () => {
    const r = computeShares(999, "shares", [
      { userId: "a", value: 1 },
      { userId: "b", value: 0 },
      { userId: "c", value: 1 },
    ]);
    expect(cents(r)).toEqual({ a: 500, b: 0, c: 499 });
  });

  it("exact: cuadra o devuelve sum_mismatch con lo que falta", () => {
    expect(cents(computeShares(1000, "exact", [{ userId: "a", value: 600 }, { userId: "b", value: 400 }]))).toEqual({ a: 600, b: 400 });
    expect(computeShares(1000, "exact", [{ userId: "a", value: 600 }, { userId: "b", value: 300 }])).toEqual({
      ok: false,
      error: "sum_mismatch",
      remainingCents: 100,
    });
  });

  it("rechaza entradas inválidas", () => {
    expect(computeShares(0, "equal", [{ userId: "a" }])).toMatchObject({ ok: false, error: "invalid_total" });
    expect(computeShares(100, "equal", [])).toMatchObject({ ok: false, error: "no_participants" });
    expect(computeShares(100, "percent", [{ userId: "a", value: -1 }])).toMatchObject({ ok: false, error: "invalid_value" });
    expect(computeShares(100, "shares", [{ userId: "a", value: 0 }])).toMatchObject({ ok: false, error: "invalid_value" });
  });
});
