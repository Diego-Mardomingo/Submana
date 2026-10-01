/**
 * import_source_fingerprint: stable per bank row (no account id); the server derives import_line_id.
 * external_hash: semantic fingerprint (date + amount + description).
 */
export interface ImportedTransaction {
  date: string;
  amount: number;
  type: "income" | "expense";
  description: string;
  external_hash: string;
  import_source_fingerprint: string;
  /** Account balance printed in the statement (e.g. Revolut), when available. */
  statement_balance?: number;
}

export interface PossibleDuplicate {
  /** Same key as buildDuplicateConflictKey (day + amount + type). */
  conflict_key: string;
  incoming: { id: string; date: string; amount: number; description: string; external_hash: string };
  existing: { id: string; description: string; date: string; amount: number };
}

export interface ImportTransactionsResponse {
  imported: number;
  skipped: number;
  total: number;
  new_balance: number;
  /** Rows tagged as internal transfers ("exclude from metrics" category). */
  internal_transfers_tagged?: number;
  possibleDuplicates?: PossibleDuplicate[];
}
