import { describe, expect, it } from "vitest";
import { expenseChangedFor, expenseEvents, expenseParticipants, expenseRecipients, expenseUpdateRecipients, settlementEvents, shareOf, type ExpenseState } from "./subcount";

const ana = "ana";
const luis = "luis";
const eva = "eva";

const expense = (paidBy: string, shares: Record<string, number>, total = Object.values(shares).reduce((a, b) => a + b, 0), title = "Cena"): ExpenseState => ({
  title,
  total,
  paidBy,
  shares: Object.entries(shares).map(([userId, amount]) => ({ userId, amount })),
});

describe("expenseParticipants", () => {
  it("is the payer plus everyone with a share above 0", () => {
    expect(expenseParticipants(expense(ana, { luis: 10, eva: 0 }, 10)).sort()).toEqual([ana, luis]);
  });

  it("includes the payer even when they have no share, once when they do", () => {
    expect(expenseParticipants(expense(ana, { ana: 5, luis: 5 }))).toEqual([ana, luis]);
    expect(expenseParticipants(expense(ana, { luis: 10 }))).toEqual([ana, luis]);
  });
});

describe("shareOf", () => {
  it("is the user's amount, 0 when they are not in the split", () => {
    const e = expense(ana, { ana: 4.5, luis: 5.5 });
    expect(shareOf(e, luis)).toBe(5.5);
    expect(shareOf(e, eva)).toBe(0);
  });
});

describe("expenseRecipients", () => {
  it("leaves the author out", () => {
    expect(expenseRecipients(expense(ana, { ana: 5, luis: 5 }), ana)).toEqual([luis]);
    expect(expenseRecipients(expense(ana, { ana: 5, luis: 5 }), luis)).toEqual([ana]);
  });
});

describe("expenseUpdateRecipients", () => {
  const before = expense(ana, { ana: 10, luis: 10, eva: 10 });

  it("notifies nobody when only the title or date changed", () => {
    expect(expenseUpdateRecipients(before, { ...before, title: "Cena en casa" }, ana)).toEqual([]);
  });

  it("notifies every participant but the author when the total changes", () => {
    const after = expense(ana, { ana: 20, luis: 20, eva: 20 });
    expect(expenseUpdateRecipients(before, after, ana).sort()).toEqual([eva, luis]);
  });

  it("notifies everyone when the payer changes, even with the same shares", () => {
    expect(expenseUpdateRecipients(before, { ...before, paidBy: luis }, ana).sort()).toEqual([eva, luis]);
    expect(expenseUpdateRecipients(before, { ...before, paidBy: luis }, luis).sort()).toEqual([ana, eva]);
  });

  it("notifies only those whose share changed when the total is the same", () => {
    const after = expense(ana, { ana: 10, luis: 15, eva: 5 }, 30);
    expect(expenseUpdateRecipients(before, after, ana).sort()).toEqual([eva, luis]);
    const swap = expense(ana, { ana: 10, luis: 20, eva: 0 }, 30);
    // eva left the split, luis pays more: both hear it; ana wrote it.
    expect(expenseUpdateRecipients(before, swap, ana).sort()).toEqual([eva, luis]);
  });

  it("includes people added or removed from the split and compares in cents", () => {
    const small = expense(ana, { ana: 10.1, luis: 10 }, 20.1);
    const withEva = expense(ana, { ana: 10.1, luis: 10, eva: 0.01 }, 20.11);
    expect(expenseUpdateRecipients(small, withEva, luis).sort()).toEqual([ana, eva]);
    expect(expenseChangedFor(small, { ...small, shares: [{ userId: ana, amount: 10.1 }, { userId: luis, amount: 10.0000001 }] }, luis)).toBe(false);
  });

  it("does not notify an unchanged participant when only someone else's share moved (same total and payer)", () => {
    const a = expense(ana, { ana: 10, luis: 10, eva: 10 });
    const b = expense(ana, { ana: 5, luis: 10, eva: 15 });
    expect(expenseUpdateRecipients(a, b, ana)).toEqual([eva]);
  });
});

describe("expenseEvents", () => {
  it("builds one event per recipient with that recipient's own share", () => {
    const e = expense(ana, { ana: 10, luis: 6, eva: 4 });
    const events = expenseEvents({ kind: "added", groupId: "g", groupName: "Piso", expenseId: "x", expense: e, recipients: [luis, eva], actorId: ana, actorName: "Ana" });
    expect(events.map((ev) => [ev.userId, ev.type, "share" in ev.params ? ev.params.share : null])).toEqual([
      [luis, "shared.expense_added", 6],
      [eva, "shared.expense_added", 4],
    ]);
    expect(events[0]).toMatchObject({ actorId: ana, entityType: "shared_expense", entityId: "x", params: { groupId: "g", groupName: "Piso", title: "Cena", total: 20, actorName: "Ana" } });
  });

  it("uses the event type of the kind", () => {
    const e = expense(ana, { luis: 5 });
    for (const kind of ["updated", "deleted"] as const) {
      const [event] = expenseEvents({ kind, groupId: "g", groupName: "Piso", expenseId: "x", expense: e, recipients: [luis], actorId: ana, actorName: "" });
      expect(event.type).toBe(`shared.expense_${kind}`);
    }
  });
});

describe("settlementEvents", () => {
  const base = { groupId: "g", groupName: "Piso", expenseId: "s", amount: 12.5, actorName: "Ana" };

  it("tells the creditor when the debtor records the payment", () => {
    const [event] = settlementEvents({ ...base, from: ana, to: luis, actorId: ana });
    expect(event).toMatchObject({ userId: luis, type: "shared.settlement", params: { payer: "actor", amount: 12.5 } });
  });

  it("tells the debtor when the creditor records it, as a payment the recipient made", () => {
    const [event] = settlementEvents({ ...base, from: ana, to: luis, actorId: luis });
    expect(event).toMatchObject({ userId: ana, params: { payer: "recipient" } });
  });

  it("ignores an actor who is neither side", () => {
    expect(settlementEvents({ ...base, from: ana, to: luis, actorId: eva })).toEqual([]);
  });
});
