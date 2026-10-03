import { describe, expect, it } from "vitest";
import { draftParticipants, evaluateDraft, initialDraft, isDraftSubmittable } from "./splitDraft";

describe("splitDraft", () => {
  it("equal: reparte y siempre es enviable", () => {
    const draft = initialDraft(["me", "ana"]);
    const ev = evaluateDraft(draft, 4000, "me");
    expect(Object.fromEntries(ev.centsByUser)).toEqual({ me: 2000, ana: 2000 });
    expect(ev.remaining).toBeNull();
    expect(isDraftSubmittable(ev, draft)).toBe(true);
    expect(draftParticipants(draft)).toEqual([{ user_id: "me" }, { user_id: "ana" }]);
  });

  it("exact: el contador indica los céntimos que faltan y no se puede enviar hasta cuadrar", () => {
    const draft = { ...initialDraft(["me", "ana"]), mode: "exact" as const, values: { me: "15,50", ana: "20" } };
    const ev = evaluateDraft(draft, 4000, "me");
    expect(ev.remaining).toBe(450);
    expect(isDraftSubmittable(ev, draft)).toBe(false);
    const fixed = { ...draft, values: { me: "20", ana: "20" } };
    expect(isDraftSubmittable(evaluateDraft(fixed, 4000, "me"), fixed)).toBe(true);
  });

  it("percent: exige sumar 100", () => {
    const draft = { ...initialDraft(["me", "ana"]), mode: "percent" as const, values: { me: "60", ana: "30" } };
    const ev = evaluateDraft(draft, 1000, "me");
    expect(ev.remaining).toBe(10);
    expect(isDraftSubmittable(ev, draft)).toBe(false);
  });

  it("shares: el peso por defecto es 1", () => {
    const draft = { ...initialDraft(["me", "ana"]), mode: "shares" as const, values: { ana: "3" } };
    expect(Object.fromEntries(evaluateDraft(draft, 1000, "me").centsByUser)).toEqual({ me: 250, ana: 750 });
  });
});
