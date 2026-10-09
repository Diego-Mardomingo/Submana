import type { CrossedBudget } from "@/lib/budgetThresholds";

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

export type ImportRowStatus = "new" | "sure" | "possible" | "already_imported" | "skipped";

/** Unreconciled manual transaction a statement line probably corresponds to. */
export interface ImportRowMatch {
  id: string;
  date: string;
  description: string | null;
  amount: number;
  category_id: string | null;
  /** 0-1, see src/lib/dedup/matchScore.ts. */
  score: number;
  /** Bank day minus manual day, in calendar days. */
  deltaDays: number;
  /** Description similarity (null when the manual transaction has no description). */
  descScore: number | null;
}

/** Classification of one statement line, keyed by its import_source_fingerprint. */
export interface ImportPreviewRow {
  fingerprint: string;
  status: ImportRowStatus;
  match?: ImportRowMatch;
}


export interface ImportPreviewResponse {
  transactions: ImportPreviewRow[];
  deposit: ImportPreviewRow[];
}

/** User decision for a statement line; the server revalidates every merge. */
export interface ImportResolution {
  fingerprint: string;
  action: "merge" | "insert" | "skip";
  /** Manual transaction to merge into (defaults to the best match). */
  target_id?: string;
}

export interface ImportTransactionsResponse {
  imported: number;
  /** Bank lines merged into an existing manual transaction. */
  merged: number;
  skipped: number;
  total: number;
  new_balance: number;
  /** Rows tagged as internal transfers ("exclude from metrics" category). */
  internal_transfers_tagged?: number;
  /** Budgets that crossed 80 % / 100 % because of this import (the client shows one toast). */
  crossedBudgets?: CrossedBudget[];
}
