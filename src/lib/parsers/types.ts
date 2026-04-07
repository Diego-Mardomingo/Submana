/**
 * import_source_fingerprint: stable per bank row (no account id); server derives import_line_id.
 * external_hash: semantic fingerprint for heuristics / categories (date + amount + description).
 */
export interface ImportedTransaction {
  date: string;
  amount: number;
  type: "income" | "expense";
  description: string;
  external_hash: string;
  import_source_fingerprint: string;
  /** Saldo de cuenta según extracto (p. ej. Revolut); opcional. */
  statement_balance?: number;
}

export interface ImportTransactionsRequest {
  account_id: string;
  transactions: ImportedTransaction[];
  final_balance?: number;
}

export interface PossibleDuplicate {
  /** SHA-256 for import_duplicate_decisions (same as buildDuplicateConflictKey). */
  conflict_key: string;
  incoming: {
    id: string;
    date: string;
    amount: number;
    description: string;
    external_hash: string;
  };
  existing: {
    id: string;
    description: string;
    date: string;
    amount: number;
  };
}

export interface ImportTransactionsResponse {
  imported: number;
  skipped: number;
  total: number;
  new_balance: number;
  possibleDuplicates?: PossibleDuplicate[];
}

export interface TradeRepublicCashTransaction {
  datum: string;
  typ: string;
  beschreibung: string;
  zahlungseingang: string;
  zahlungsausgang: string;
  saldo: string;
}

export interface ParsedPDFResult {
  cash: TradeRepublicCashTransaction[];
  interest: unknown[];
  portfolio: unknown[];
  crypto: unknown[];
  finalBalance?: number;
}
