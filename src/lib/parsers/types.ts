export interface ImportedTransaction {
  date: string;
  amount: number;
  type: "income" | "expense";
  description: string;
  external_hash: string;
}

export interface ImportTransactionsRequest {
  account_id: string;
  transactions: ImportedTransaction[];
  final_balance?: number;
}

export interface PossibleDuplicate {
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
