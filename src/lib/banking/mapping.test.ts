import { describe, expect, it } from "vitest";
import { addDays, suggestSyncFrom, syncWindowStart } from "./dates";
import { accountLast4, bankDescription, hasTransactionDetails, pickBalance, toStatementRows } from "./mapping";
import type { EbTransaction } from "./types";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";

const tx = (over: Partial<EbTransaction> = {}): EbTransaction => ({
  transaction_amount: { amount: "12.50", currency: "EUR" },
  credit_debit_indicator: "DBIT",
  status: "BOOK",
  booking_date: "2026-10-10",
  ...over,
});

describe("accountLast4", () => {
  it("takes the IBAN's last 4 characters, ignoring spaces", () => {
    expect(accountLast4({ account_id: { iban: "ES12 3456 7890 1234 5678 9012" } })).toBe("9012");
  });
  it("falls back to another identifier and to null", () => {
    expect(accountLast4({ account_id: { iban: null, other: { identification: "ACC-0042" } } })).toBe("0042");
    expect(accountLast4({ account_id: null })).toBeNull();
  });
});

describe("pickBalance", () => {
  it("prefers the available balance and rounds to cents", () => {
    const balances = [
      { balance_type: "CLBD", balance_amount: { amount: "100.00", currency: "EUR" } },
      { balance_type: "ITAV", balance_amount: { amount: "95.555", currency: "EUR" } },
    ];
    expect(pickBalance(balances)).toBe(95.56);
  });
  it("accepts unknown types (Trade Republic sends OTHR) and returns null without a number", () => {
    expect(pickBalance([{ balance_type: "OTHR", balance_amount: { amount: "1234.5", currency: "EUR" } }])).toBe(1234.5);
    expect(pickBalance([{ balance_type: "ITAV", balance_amount: { amount: "n/a", currency: "EUR" } }])).toBeNull();
    expect(pickBalance([])).toBeNull();
  });
});

describe("bankDescription", () => {
  it("uses the creditor for expenses and the debtor for income", () => {
    const parties = { creditor: { name: "Mercadona" }, debtor: { name: "Empresa SL" } };
    expect(bankDescription(tx({ ...parties, credit_debit_indicator: "DBIT" }))).toBe("Mercadona");
    expect(bankDescription(tx({ ...parties, credit_debit_indicator: "CRDT" }))).toBe("Empresa SL");
  });
  it("falls back to the remittance texts, then to an empty string", () => {
    expect(bankDescription(tx({ creditor: { name: " " }, remittance_information: ["Pago  a", "", "Juan"] }))).toBe("Pago a · Juan");
    expect(bankDescription(tx())).toBe("");
  });
});

describe("hasTransactionDetails", () => {
  it("is false for Trade Republic's amount-and-date-only rows, true once an id or a description shows up", () => {
    expect(hasTransactionDetails([tx(), tx({ booking_date: "2026-10-09" })])).toBe(false);
    expect(hasTransactionDetails([])).toBe(false);
    expect(hasTransactionDetails([tx(), tx({ creditor: { name: "Mercadona" } })])).toBe(true);
    expect(hasTransactionDetails([tx({ remittance_information: ["Bizum"] })])).toBe(true);
    expect(hasTransactionDetails([tx({ transaction_id: "abc" })])).toBe(true);
  });
});

describe("toStatementRows", () => {
  it("signs amounts by direction and uses the bank's id as the fingerprint", async () => {
    const rows = await toStatementRows(ACCOUNT, [tx({ entry_reference: "abc", creditor: { name: "Bar" } }), tx({ entry_reference: "def", credit_debit_indicator: "CRDT", transaction_amount: { amount: "1000", currency: "EUR" } })], null);
    expect(rows.map((r) => [r.type, r.amount, r.description])).toEqual([
      ["expense", 12.5, "Bar"],
      ["income", 1000, ""],
    ]);
    expect(rows[0].import_source_fingerprint).toBe("bank|ref|abc|occ:0");
    expect(rows[0].date).toBe("2026-10-10");
  });

  it("drops pending rows, rows without a date and rows before the start day", async () => {
    const rows = await toStatementRows(
      ACCOUNT,
      [tx({ status: "PDNG" }), tx({ booking_date: null }), tx({ booking_date: "2026-09-30" }), tx({ booking_date: "2026-10-01", entry_reference: "x" })],
      "2026-10-01"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2026-10-01");
  });

  it("numbers identical id-less rows of a day so both are kept, whatever their order", async () => {
    const a = await toStatementRows(ACCOUNT, [tx(), tx(), tx({ booking_date: "2026-10-09" })], null);
    const b = await toStatementRows(ACCOUNT, [tx({ booking_date: "2026-10-09" }), tx(), tx()], null);
    expect(a.map((r) => r.import_source_fingerprint)).toEqual(b.map((r) => r.import_source_fingerprint));
    expect(new Set(a.map((r) => r.import_source_fingerprint)).size).toBe(3);
  });

  it("skips zero amounts", async () => {
    expect(await toStatementRows(ACCOUNT, [tx({ transaction_amount: { amount: "0.00", currency: "EUR" } })], null)).toEqual([]);
  });
});

describe("sync window", () => {
  it("adds days across month ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("starts at the configured day the first time, then re-reads the overlap", () => {
    expect(syncWindowStart("2026-10-01", null, "2026-10-18")).toBe("2026-10-01");
    expect(syncWindowStart("2026-10-01", "2026-10-17T05:10:00Z", "2026-10-18")).toBe("2026-10-07");
    // Never before the configured start.
    expect(syncWindowStart("2026-10-15", "2026-10-17T05:10:00Z", "2026-10-18")).toBe("2026-10-15");
    expect(syncWindowStart(null, null, "2026-10-18")).toBe("2026-07-20");
  });

  it("suggests the day after the latest statement line (Madrid day), or the 1st of the month", () => {
    // 23:30 UTC on the 30th is already the 1st in Madrid.
    expect(suggestSyncFrom("2026-09-30T23:30:00Z", "2026-10-18")).toBe("2026-10-02");
    expect(suggestSyncFrom("2026-09-30T10:00:00Z", "2026-10-18")).toBe("2026-10-01");
    expect(suggestSyncFrom(null, "2026-10-18")).toBe("2026-10-01");
  });
});
