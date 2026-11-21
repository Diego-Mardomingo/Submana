import { describe, expect, it } from "vitest";
import { classifyMovement, explainCard, guessCategory, merchantName, normalizeMerchant, settleMatch, shownInDeck, tally, type HistoryRow } from "./classify";

const home = { category_id: "home", subcategory_id: null };
const tech = { category_id: "shop", subcategory_id: "tech" };
const gifts = { category_id: "shop", subcategory_id: "gifts" };
const row = (id: string, pair: { category_id: string; subcategory_id: string | null }, description = "AMAZON MKTPLACE*2K4L19 LU"): HistoryRow => ({ id, description, ...pair });

describe("normalizeMerchant", () => {
  it("keeps the merchant and drops references, card numbers and filler words", () => {
    expect(normalizeMerchant("AMAZON MKTPLACE*2K4L19 LU")).toBe("AMAZON MKTPLACE");
    expect(normalizeMerchant("AMAZON MKTPLACE*9Q1ZZ0 LU")).toBe("AMAZON MKTPLACE");
    expect(normalizeMerchant("COMPRA TARJ. 5402 MERCADONA MADRID")).toBe("MERCADONA MADRID");
    expect(normalizeMerchant("PAYPAL *STEAM GAMES 4029357733")).toBe("PAYPAL STEAM");
    expect(normalizeMerchant("Café Federal")).toBe("CAFE FEDERAL");
  });

  it("is empty when nothing recognisable is left", () => {
    expect(normalizeMerchant("12345 *** 00")).toBe("");
    expect(normalizeMerchant(null)).toBe("");
  });
});

describe("guessCategory", () => {
  it("recognises well-known merchants by their words", () => {
    expect(guessCategory("TPV 4402 LA TASQUITA MADRID", "expense")?.subcategory_id).toMatch(/303$/);
    expect(guessCategory("REPSOL E.S. 2231", "expense")?.subcategory_id).toMatch(/202$/);
    expect(guessCategory("NOMINA OCTUBRE", "income")?.subcategory_id).toMatch(/902$/);
  });

  it("only guesses the salary for income and the rest for expenses", () => {
    expect(guessCategory("NOMINA OCTUBRE", "expense")).toBeNull();
    expect(guessCategory("MERCADONA", "income")).toBeNull();
  });

  it("matches whole words only", () => {
    expect(guessCategory("BARCELONA PARKING", "expense")).toBeNull();
  });
});

describe("classifyMovement", () => {
  const tx = { description: "AMAZON MKTPLACE*AAA LU", type: "expense" };

  it("is sure with a rule, whatever the history says", () => {
    expect(classifyMovement({ tx, rule: tech, inherited: home, merchantHistory: [row("1", home), row("2", gifts)] })).toEqual({ reason: "sure", pair: tech });
  });

  it("is sure when every earlier movement of the merchant (two or more) has the same category", () => {
    expect(classifyMovement({ tx, rule: null, inherited: null, merchantHistory: [row("1", home), row("2", home)] })).toEqual({ reason: "sure", pair: home });
  });

  it("doubts a merchant seen only once, or spread over categories (suggesting the most used)", () => {
    expect(classifyMovement({ tx, rule: null, inherited: null, merchantHistory: [row("1", home)] }).reason).toBe("doubt");
    const spread = classifyMovement({ tx, rule: null, inherited: null, merchantHistory: [row("1", tech), row("2", home), row("3", home)] });
    expect(spread).toEqual({ reason: "doubt", pair: home });
  });

  it("keeps the category inherited from the exact same text", () => {
    expect(classifyMovement({ tx, rule: null, inherited: tech, merchantHistory: [row("1", home), row("2", home), row("3", tech)] }).pair).toEqual(tech);
  });

  it("calls a merchant never seen new, with a guess from its words when there is one", () => {
    expect(classifyMovement({ tx: { description: "LA TASQUITA", type: "expense" }, rule: null, inherited: null, merchantHistory: [] }).reason).toBe("new");
    expect(classifyMovement({ tx: { description: "LA TASQUITA", type: "expense" }, rule: null, inherited: null, merchantHistory: [] }).pair?.subcategory_id).toMatch(/303$/);
    expect(classifyMovement({ tx: { description: "XYZ QWERTY", type: "expense" }, rule: null, inherited: null, merchantHistory: [] }).pair).toBeNull();
  });
});

describe("tally", () => {
  it("counts categories, most used first", () => {
    expect(tally([row("1", tech), row("2", home), row("3", home)])).toEqual([
      { pair: home, count: 2 },
      { pair: tech, count: 1 },
    ]);
  });
});

describe("settleMatch", () => {
  const dinner = { id: "d", amount: 38.5, type: "expense", date: "2026-11-18T21:47:00Z", description: "LA TASQUITA" };

  it("matches a Bizum that arrives soon after a bigger expense", () => {
    const bizum = { id: "b", amount: 21.6, type: "income", date: "2026-11-18T22:05:00Z", description: "BIZUM DE LAURA GOMEZ · CENA" };
    expect(settleMatch(bizum, [dinner])?.id).toBe("d");
  });

  it("ignores income that isn't a Bizum or transfer, bigger than the expense, or too late", () => {
    expect(settleMatch({ id: "n", amount: 21.6, type: "income", date: "2026-11-18T22:05:00Z", description: "NOMINA" }, [dinner])).toBeNull();
    expect(settleMatch({ id: "b", amount: 50, type: "income", date: "2026-11-18T22:05:00Z", description: "BIZUM DE LAURA" }, [dinner])).toBeNull();
    expect(settleMatch({ id: "b", amount: 10, type: "income", date: "2026-11-20T22:05:00Z", description: "BIZUM DE LAURA" }, [dinner])).toBeNull();
  });
});

describe("shownInDeck", () => {
  it("hides sure movements and subscription charges unless reviewing everything", () => {
    expect(shownInDeck({ review_reason: "sure" }, "doubt")).toBe(false);
    expect(shownInDeck({ review_reason: "doubt", subscription_id: "s" }, "doubt")).toBe(false);
    expect(shownInDeck({ review_reason: "doubt" }, "doubt")).toBe(true);
    expect(shownInDeck({ review_reason: "sure", subscription_id: "s" }, "all")).toBe(true);
  });
});

describe("explainCard", () => {
  const base = { description: "AMAZON MKTPLACE*AAA LU", type: "expense", review_reason: "doubt", ...home };

  it("lists the other categories of a spread merchant", () => {
    const insight = explainCard({ tx: base, rule: null, merchantHistory: [row("1", home), row("2", home), row("3", tech), row("4", gifts)] });
    expect(insight.alternatives).toEqual([tech, gifts]);
    expect(insight.why).toMatchObject({ kind: "split" });
  });

  it("explains a rule, a new merchant and a merchant seen once", () => {
    expect(explainCard({ tx: base, rule: home, merchantHistory: [] }).why).toEqual({ kind: "rule", pattern: "AMAZON MKTPLACE" });
    expect(explainCard({ tx: base, rule: null, merchantHistory: [] }).why).toEqual({ kind: "new", guessed: true });
    expect(explainCard({ tx: base, rule: null, merchantHistory: [row("1", home)] }).why).toEqual({ kind: "once" });
  });
});

describe("classifyMovement and transfers", () => {
  it("leaves a transfer without a category so it can be paired with its other half", () => {
    const history = [row("1", home, "TRANSFERENCIA A CTA 1111"), row("2", home, "TRANSFERENCIA A CTA 2222")];
    expect(classifyMovement({ tx: { description: "TRANSFERENCIA A CTA 4821", type: "expense" }, rule: null, inherited: null, merchantHistory: history }).pair).toBeNull();
  });
});

describe("merchantName", () => {
  it("turns a bank text in capitals into a readable name", () => {
    expect(merchantName("TPV 4402 LA TASQUITA MADRID")).toBe("Tasquita Madrid");
    expect(merchantName("AMAZON MKTPLACE*2K4L19 LU")).toBe("Amazon Mktplace");
    expect(merchantName("BIZUM DE LAURA GOMEZ CENA")).toBe("Bizum Laura Gomez");
    expect(merchantName("CAFÉ FEDERAL")).toBe("Café Federal");
  });

  it("leaves names someone already wrote", () => {
    expect(merchantName("Mercadona")).toBe("Mercadona");
    expect(merchantName("Cena con Laura")).toBe("Cena con Laura");
  });
});
