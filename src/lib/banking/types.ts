/** The parts of Enable Banking's payloads Submana reads (every field the API may omit is optional). */

type Party = { name?: string | null } | null;
type AccountId = { iban?: string | null; other?: { identification?: string | null } | null } | null;

export interface EbAccount {
  uid: string;
  identification_hash: string;
  account_id?: AccountId;
  /** Some banks put the holder's name here, not the account's: don't show it as the account label. */
  name?: string | null;
  product?: string | null;
  currency?: string | null;
  cash_account_type?: string | null;
}

export interface EbBalance {
  balance_type: string;
  balance_amount: { amount: string; currency: string };
  reference_date?: string | null;
}

export interface EbTransaction {
  entry_reference?: string | null;
  transaction_id?: string | null;
  transaction_amount: { amount: string; currency: string };
  credit_debit_indicator: "CRDT" | "DBIT";
  status?: string | null;
  booking_date?: string | null;
  value_date?: string | null;
  transaction_date?: string | null;
  creditor?: Party;
  debtor?: Party;
  remittance_information?: string[] | null;
}

/** Banks Submana can connect, keyed by the account's `bank_provider`. */
export const BANK_ASPSPS = {
  revolut: { name: "Revolut", country: "ES", defaultMode: "full" },
  // Trade Republic's PSD2 data has no descriptions nor ids: balance only unless the user opts in.
  trade_republic: { name: "Trade Republic", country: "ES", defaultMode: "balance" },
} as const satisfies Record<string, { name: string; country: string; defaultMode: SyncMode }>;

export type SyncMode = "full" | "balance";
export type ConnectableProvider = keyof typeof BANK_ASPSPS;

export const isConnectableProvider = (provider: string | null | undefined): provider is ConnectableProvider =>
  !!provider && Object.hasOwn(BANK_ASPSPS, provider);

/** What the app shows about a bank connection (never the session id). */
export interface BankConnectionView {
  id: string;
  aspsp_name: string;
  status: "pending" | "active" | "expired" | "revoked";
  valid_until: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  links: BankLinkView[];
}

export interface BankLinkView {
  id: string;
  account_id: string | null;
  iban_last4: string | null;
  currency: string | null;
  sync_mode: SyncMode;
  sync_from: string | null;
  last_synced_at: string | null;
  /** Suggested first day to import for this account (day after its latest statement line). */
  suggested_sync_from?: string;
}

export interface BankSyncResult {
  imported: number;
  merged: number;
  review: number;
  balanceUpdated: boolean;
}
