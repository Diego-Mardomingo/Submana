import { describe, expect, it } from "vitest";
import { normalizeHandle, suggestHandle, validateHandle } from "./handles";

describe("normalizeHandle", () => {
  it("strips @, trims and lowercases", () => {
    expect(normalizeHandle("  @Diego_M ")).toBe("diego_m");
    expect(normalizeHandle("ANA")).toBe("ana");
  });
});

describe("validateHandle", () => {
  it("accepts valid handles", () => {
    expect(validateHandle("@ana_01")).toBeNull();
    expect(validateHandle("abc")).toBeNull();
    expect(validateHandle("a".repeat(20))).toBeNull();
  });
  it("rejects bad shapes", () => {
    expect(validateHandle("ab")).toBe("handle_invalid");
    expect(validateHandle("a".repeat(21))).toBe("handle_invalid");
    expect(validateHandle("ana.garcia")).toBe("handle_invalid");
    expect(validateHandle("ana garcia")).toBe("handle_invalid");
    expect(validateHandle("")).toBe("handle_invalid");
  });
  it("rejects reserved names", () => {
    expect(validateHandle("Admin")).toBe("handle_reserved");
    expect(validateHandle("@submana")).toBe("handle_reserved");
  });
});

describe("suggestHandle", () => {
  it("folds accents and joins words", () => {
    expect(suggestHandle("x@gmail.com", "José Ángel Núñez")).toBe("jose_angel_nunez");
  });
  it("falls back to the email local part", () => {
    expect(suggestHandle("diego.lopez@gmail.com", null)).toBe("diego_lopez");
  });
  it("truncates to 20 chars", () => {
    expect(suggestHandle(null, "Maximiliano Alejandro Fernandez").length).toBeLessThanOrEqual(20);
  });
  it("always returns a valid handle", () => {
    for (const [e, n] of [[null, null], ["a@b.c", "A"], ["@@", "!!!"], ["admin@x.com", null]] as const) {
      expect(validateHandle(suggestHandle(e, n))).toBeNull();
    }
  });
});
