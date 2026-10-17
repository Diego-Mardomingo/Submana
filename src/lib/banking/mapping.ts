/** Pure translation of Enable Banking payloads into what the statement import already understands. */
import { fingerprintText, toImportedTransactions } from "@/lib/parsers/utils";
import type { ImportedTransaction } from "@/lib/parsers/types";
import type { EbAccount, EbBalance, EbTransaction } from "./types";

/** Balance types in order of preference: available first, then booked, then whatever the bank calls it. */
const BALANCE_PREFERENCE = ["ITAV", "CLAV", "XPCD", "ITBD", "CLBD", "OPAV", "OTHR"];

/** Last 4 characters of the account's IBAN (or other identifier); null without one. */
export function accountLast4(account: Pick<EbAccount, "account_id">): string | null {
  const id = (account.account_id?.iban || account.account_id?.other?.identification || "").replace(/\s/g, "");
  return id.length >= 4 ? id.slice(-4) : null;
}

/** The account's current balance from the bank's list, or null when there is none in a usable format. */
export function pickBalance(balances: readonly EbBalance[]): number | null {
  const ranked = [...balances].sort((a, b) => rank(a.balance_type) - rank(b.balance_type));
  for (const balance of ranked) {
    const amount = Number(balance.balance_amount?.amount);
    if (Number.isFinite(amount)) return Math.round(amount * 100) / 100;
  }
  return null;
}

const rank = (type: string) => {
  const index = BALANCE_PREFERENCE.indexOf(type);
  return index === -1 ? BALANCE_PREFERENCE.length : index;
};

const clean = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

/** Who the money went to (expense) or came from (income); else the payment reference texts. */
export function bankDescription(tx: EbTransaction): string {
  const party = tx.credit_debit_indicator === "CRDT" ? tx.debtor?.name : tx.creditor?.name;
  if (clean(party)) return clean(party);
  return (tx.remittance_information ?? []).map(clean).filter(Boolean).join(" · ");
}

export const bookingDate = (tx: EbTransaction) => tx.booking_date || tx.value_date || tx.transaction_date || null;

/**
 * Booked bank transactions on or after `syncFrom` (YYYY-MM-DD) as statement rows for `accountId`. The
 * fingerprint is the bank's id for the transaction when it gives one; otherwise day + amount +
 * description, numbered per occurrence (identical rows of a day are interchangeable).
 */
export function toStatementRows(accountId: string, transactions: readonly EbTransaction[], syncFrom: string | null): Promise<ImportedTransaction[]> {
  const rows = transactions.flatMap((tx) => {
    if (tx.status && tx.status !== "BOOK") return [];
    const date = bookingDate(tx)?.slice(0, 10);
    if (!date || (syncFrom && date < syncFrom)) return [];
    const amount = Math.abs(Number(tx.transaction_amount?.amount));
    if (!Number.isFinite(amount)) return [];
    const signedAmount = tx.credit_debit_indicator === "CRDT" ? amount : -amount;
    const description = bankDescription(tx);
    const ref = tx.entry_reference || tx.transaction_id;
    const fingerprint = ref ? `bank|ref|${ref}` : `bank|${date}|${signedAmount.toFixed(2)}|${fingerprintText(description)}`;
    return [{ date, signedAmount, description, fingerprint }];
  });
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return toImportedTransactions(accountId, rows);
}
