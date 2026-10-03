import { describe, expect, it } from "vitest";
import { classifyImportRows, decisionAction } from "./classifyImport";
import { matchScore } from "./matchScore";
import { descriptionTokens } from "./normalizeDescription";

const manual = (id: string, date: string, description: string | null, amount = 40) => ({ id, type: "expense", amount, date, description });
const bank = (date: string, description: string, amount = 40) => ({ type: "expense", amount, date, description });

describe("descriptionTokens", () => {
  it("quita acentos, puntuación, números largos y palabras de ruido", () => {
    expect(descriptionTokens("COMPRA TARJETA Café Bar-Ñoño 1234 5678 SL")).toEqual(["cafe", "bar", "nono"]);
  });

  it("aplica alias y elimina duplicados", () => {
    expect(descriptionTokens("AMZN Amazon")).toEqual(["amazon"]);
  });

  it("devuelve vacío sin descripción", () => {
    expect(descriptionTokens(null)).toEqual([]);
    expect(descriptionTokens("Bizum pago 123456")).toEqual([]);
  });
});

describe("matchScore", () => {
  it("exige mismo tipo e importe al céntimo", () => {
    expect(matchScore(bank("2026-03-15T10:00:00Z", "Mercadona"), manual("m", "2026-03-15", "Mercadona", 40.01))).toBeNull();
    expect(matchScore({ ...bank("2026-03-15T10:00:00Z", "Mercadona"), type: "income" }, manual("m", "2026-03-15", "Mercadona"))).toBeNull();
  });

  it("acepta -2..+5 días (banco - manual) y rechaza fuera de la ventana", () => {
    const m = manual("m", "2026-03-15", "Mercadona");
    expect(matchScore(bank("2026-03-13T10:00:00Z", "Mercadona"), m)?.deltaDays).toBe(-2);
    expect(matchScore(bank("2026-03-20T10:00:00Z", "Mercadona"), m)?.deltaDays).toBe(5);
    expect(matchScore(bank("2026-03-12T10:00:00Z", "Mercadona"), m)).toBeNull();
    expect(matchScore(bank("2026-03-21T10:00:00Z", "Mercadona"), m)).toBeNull();
  });

  it("los prefijos de 4+ caracteres cuentan como coincidencia", () => {
    const result = matchScore(bank("2026-03-15T10:00:00Z", "Mercadona Madrid"), manual("m", "2026-03-15", "Mercad"));
    expect(result?.descScore).toBe(1);
  });
});

describe("classifyImportRows", () => {
  it("Trade Republic: pagado el 15 y apunta el 18 con el mismo comercio es sure", () => {
    const [r] = classifyImportRows([bank("2026-03-18T09:30:00Z", "COMPRA TARJETA MERCADONA 4821")], [manual("m1", "2026-03-15", "Mercadona")]);
    expect(r.status).toBe("sure");
    expect(r.match?.candidate.id).toBe("m1");
    expect(r.match?.deltaDays).toBe(3);
  });

  it("-3 y +6 días no tienen candidato", () => {
    const rows = [bank("2026-03-12T10:00:00Z", "Mercadona"), bank("2026-03-21T10:00:00Z", "Mercadona")];
    const result = classifyImportRows(rows, [manual("m1", "2026-03-15", "Mercadona")]);
    expect(result.map((r) => r.status)).toEqual(["new", "new"]);
  });

  it("dos cafés iguales de 3 € se emparejan 1:1", () => {
    const rows = [bank("2026-03-15T08:00:00Z", "Cafe Central", 3), bank("2026-03-15T09:00:00Z", "Cafe Central", 3)];
    const candidates = [manual("a", "2026-03-15", "Cafe Central", 3), manual("b", "2026-03-15", "Cafe Central", 3)];
    const result = classifyImportRows(rows, candidates);
    const ids = result.map((r) => r.match?.candidate.id);
    expect(new Set(ids).size).toBe(2);
    // Indistinguishable candidates: never auto-merged.
    expect(result.every((r) => r.status === "possible")).toBe(true);
  });

  it("una manual sin descripción es possible y nunca sure", () => {
    const [r] = classifyImportRows([bank("2026-03-15T10:00:00Z", "Mercadona")], [manual("m1", "2026-03-15", null)]);
    expect(r.status).toBe("possible");
  });

  it("sin candidatos todo es new", () => {
    expect(classifyImportRows([bank("2026-03-15T10:00:00Z", "Mercadona")], [])[0].status).toBe("new");
  });

  it("respeta las decisiones guardadas, también las antiguas", () => {
    const m = [manual("m1", "2026-03-15", "Mercadona")];
    const line = bank("2026-03-15T10:00:00Z", "Mercadona");
    expect(classifyImportRows([{ ...line, decision: "keep_existing" }], m)[0].status).toBe("skipped");
    expect(classifyImportRows([{ ...line, decision: "skip_bank_line" }], m)[0].status).toBe("skipped");
    expect(classifyImportRows([{ ...line, decision: "keep_import" }], m)[0].status).toBe("new");
    expect(classifyImportRows([{ ...line, decision: "keep_both" }], m)[0].status).toBe("new");
    expect(decisionAction(undefined)).toBeUndefined();
  });
});
