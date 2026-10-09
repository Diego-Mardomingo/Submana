import { describe, expect, it } from "vitest";
import { hrefWithoutParams, parseIdParam, parseMonthParam } from "./deepLinks";

describe("parseIdParam", () => {
  it("accepts uuids and simple ids", () => {
    expect(parseIdParam("3f2b8c1e-9d4a-4b6e-8f10-2a7c5d9e1b34")).toBe("3f2b8c1e-9d4a-4b6e-8f10-2a7c5d9e1b34");
    expect(parseIdParam("abc_123")).toBe("abc_123");
  });

  it("rejects empty values and anything that is not an id", () => {
    expect(parseIdParam(null)).toBeNull();
    expect(parseIdParam("")).toBeNull();
    expect(parseIdParam("../etc")).toBeNull();
    expect(parseIdParam("<script>")).toBeNull();
    expect(parseIdParam("a".repeat(65))).toBeNull();
  });
});

describe("parseMonthParam", () => {
  it("parses YYYY-MM", () => {
    expect(parseMonthParam("2026-09")).toEqual({ year: 2026, month: 9 });
    expect(parseMonthParam("2026-12")).toEqual({ year: 2026, month: 12 });
  });

  it("rejects other shapes and out of range months", () => {
    for (const bad of [null, undefined, "", "2026-13", "2026-00", "2026-9", "26-09", "2026-09-01", "september"]) {
      expect(parseMonthParam(bad)).toBeNull();
    }
  });
});

describe("hrefWithoutParams", () => {
  it("drops the param and keeps the rest", () => {
    expect(hrefWithoutParams("/subscriptions", "sub=abc", "sub")).toBe("/subscriptions");
    expect(hrefWithoutParams("/account/1", new URLSearchParams("tx=abc&import=1"), "tx")).toBe("/account/1?import=1");
    expect(hrefWithoutParams("/x", "a=1&b=2", ["a", "b"])).toBe("/x");
  });

  it("leaves the URL alone when the param is missing", () => {
    expect(hrefWithoutParams("/x", "a=1", "b")).toBe("/x?a=1");
  });
});
