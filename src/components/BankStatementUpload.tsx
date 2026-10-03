"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import ImportReview, { type ReviewGroup, type ReviewResolutions } from "@/components/import/ImportReview";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useLang } from "@/hooks/useLang";
import { api } from "@/lib/api";
import { BANK_PROVIDERS, type BankProvider } from "@/lib/bankProviders";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { normalizeBBVATransactions, parseBBVAExcel } from "@/lib/parsers/bbva";
import { normalizeImaginTransactions, parseImaginCSV } from "@/lib/parsers/imagin";
import { normalizeRevolutTransactions, parseRevolutCSV, parseRevolutExcel } from "@/lib/parsers/revolut";
import { normalizeTradeRepublicTransactions, parseTradeRepublicPDF } from "@/lib/parsers/tradeRepublic";
import type { ImportedTransaction, ImportPreviewResponse, ImportTransactionsResponse } from "@/lib/parsers/types";
import { queryKeys } from "@/lib/queryKeys";

type UploadState = "idle" | "parsing" | "review" | "importing" | "success" | "error";
type Callbacks = { onProgress: (current: number, total: number) => void; onStatus: (message: string) => void };

/** Parsed statement: rows for the account plus, for Revolut, rows of its savings ("remunerada") pocket. */
interface ParsedStatement {
  transactions: ImportedTransaction[];
  finalBalance: number | null;
  deposit: ImportedTransaction[];
  depositBalance: number | null;
}

interface ImportResult {
  actual?: ImportTransactionsResponse;
  deposit?: ImportTransactionsResponse;
  depositAccountCreated?: boolean;
  depositAccountId?: string;
}

async function parseStatement(file: File, provider: BankProvider, accountId: string, callbacks: Callbacks): Promise<ParsedStatement> {
  const empty = { deposit: [], depositBalance: null };
  switch (provider) {
    case "trade_republic": {
      const result = await parseTradeRepublicPDF(file, callbacks);
      return { transactions: await normalizeTradeRepublicTransactions(result.cash, accountId), finalBalance: result.finalBalance ?? null, ...empty };
    }
    case "revolut": {
      const parse = file.name.toLowerCase().endsWith(".csv") ? parseRevolutCSV : parseRevolutExcel;
      const result = await parse(file, callbacks);
      return {
        transactions: await normalizeRevolutTransactions(result.actualTransactions, accountId),
        finalBalance: result.actualBalance ?? null,
        // The savings account may not exist yet: the server hashes these rows with its real id.
        deposit: await normalizeRevolutTransactions(result.depositTransactions, "pending_deposit_account"),
        depositBalance: result.depositTransactions.length > 0 ? (result.depositBalance ?? null) : null,
      };
    }
    case "bbva": {
      const result = await parseBBVAExcel(file, callbacks);
      return { transactions: await normalizeBBVATransactions(result.transactions, accountId), finalBalance: result.finalBalance ?? null, ...empty };
    }
    case "imagin": {
      const result = await parseImaginCSV(file, callbacks);
      return { transactions: await normalizeImaginTransactions(result.transactions, accountId), finalBalance: result.finalBalance ?? null, ...empty };
    }
    default:
      throw new Error("Parser not implemented for this bank");
  }
}

function ImportStats({ title, result }: { title: React.ReactNode; result?: ImportTransactionsResponse }) {
  const t = useTranslations(useLang());
  if (!result) return null;
  return (
    <div className="bank-statement-success-stats">
      <p style={{ fontSize: "0.85rem", color: "var(--gris-claro)", marginBottom: "0.5rem", width: "100%", textAlign: "center" }}>{title}</p>
      {([[result.imported, t("import.success.imported")], [result.merged, t("import.success.merged")], [result.skipped, t("import.success.skipped")]] as const).map(([value, label]) => (
        <div key={label} className="bank-statement-success-stat">
          <span className="bank-statement-success-stat-value">{value}</span>
          <span className="bank-statement-success-stat-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function BankStatementUpload({ accountId, bankProvider, autoOpenFilePicker = false }: {
  accountId: string;
  bankProvider: BankProvider;
  autoOpenFilePicker?: boolean;
}) {
  const lang = useLang();
  const t = useTranslations(lang);
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoOpenAttemptedRef = useRef(false);
  const bank = BANK_PROVIDERS[bankProvider];

  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [statusMessage, setStatusMessage] = useState("");
  const [parsed, setParsed] = useState<ParsedStatement | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (!autoOpenFilePicker || autoOpenAttemptedRef.current || state !== "idle") return;
    autoOpenAttemptedRef.current = true;
    const timer = window.setTimeout(() => fileInputRef.current?.click(), 250);
    return () => window.clearTimeout(timer);
  }, [autoOpenFilePicker, state]);

  const fail = (err: unknown) => {
    console.error("Bank statement error:", err);
    setError(err instanceof Error ? err.message : "Unknown error");
    setState("error");
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    setState("parsing");
    setStatusMessage(t("import.processing"));
    try {
      const statement = await parseStatement(file, bankProvider, accountId, {
        onProgress: (current, total) => setProgress({ current, total }),
        onStatus: setStatusMessage,
      });
      // Classify against what is already in the account before writing anything.
      setStatusMessage(t("import.checking"));
      const classified: ImportPreviewResponse = await api("/api/import/preview", "POST", {
        account_id: accountId,
        transactions: statement.transactions,
        deposit_transactions: statement.deposit,
      });
      setParsed(statement);
      setPreview(classified);
      setState("review");
      setStatusMessage("");
    } catch (err) {
      fail(err);
    }
  };

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all }),
    ]);

  const handleImport = async (resolutions: ReviewResolutions) => {
    if (!parsed) return;
    setState("importing");
    setStatusMessage(t("import.importing"));
    try {
      const result: ImportResult = {};
      if (parsed.transactions.length > 0) {
        result.actual = await api("/api/import/transactions", "POST", {
          account_id: accountId,
          transactions: parsed.transactions,
          final_balance: parsed.finalBalance,
          resolutions: resolutions.main,
        });
      }
      if (parsed.deposit.length > 0) {
        setStatusMessage(t("import.importingSavings"));
        const data = await api("/api/import/revolut-deposit", "POST", {
          parent_account_id: accountId,
          transactions: parsed.deposit,
          final_balance: parsed.depositBalance,
          resolutions: resolutions.deposit,
        });
        Object.assign(result, { deposit: data.importResult, depositAccountCreated: data.accountCreated, depositAccountId: data.accountId });
      }
      setImportResult(result);
      setState("success");
      await invalidate();
      router.refresh();
    } catch (err) {
      fail(err);
    }
  };

  const handleReset = () => {
    setState("idle");
    setParsed(null);
    setPreview(null);
    setImportResult(null);
    setError(null);
    setStatusMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const reviewGroups: ReviewGroup[] = [];
  if (parsed && preview) {
    if (parsed.transactions.length > 0) {
      reviewGroups.push({ id: "main", title: t("import.mainAccount"), transactions: parsed.transactions, rows: preview.transactions });
    }
    if (parsed.deposit.length > 0) {
      reviewGroups.push({ id: "deposit", title: t("import.savingsAccount"), note: t("import.savingsNote"), transactions: parsed.deposit, rows: preview.deposit });
    }
  }
  const transfersTagged = (importResult?.actual?.internal_transfers_tagged ?? 0) + (importResult?.deposit?.internal_transfers_tagged ?? 0);

  return (
    <div className="bank-statement-upload">
      <div className="bank-statement-upload-header">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote brand logo */}
        <img src={bank.icon} alt={bank.name} className="bank-statement-upload-icon" />
        <div>
          <h3 className="bank-statement-upload-title">{t("import.title")}</h3>
          <p className="bank-statement-upload-subtitle">
            {bank.name} ({bank.formatLabel})
          </p>
        </div>
      </div>

      {state === "idle" && (
        <div
          className={`bank-statement-dropzone ${isDragOver ? "drag-over" : ""}`}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            handleFile(e.dataTransfer.files[0]);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragOver(false);
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={bank.acceptedFormats.join(",")}
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="hidden"
          />
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="bank-statement-dropzone-icon">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="bank-statement-dropzone-text">{t("import.dropText")}</p>
          <p className="bank-statement-dropzone-hint">
            {t("import.format")}: {bank.formatLabel}
          </p>
        </div>
      )}

      {(state === "parsing" || state === "importing") && (
        <div className="bank-statement-progress">
          <Spinner className="size-8" />
          <p className="bank-statement-progress-text">{statusMessage}</p>
          {state === "parsing" && progress.total > 0 && (
            <p className="bank-statement-progress-pages">
              {t("import.page")} {progress.current} / {progress.total}
            </p>
          )}
        </div>
      )}

      {state === "review" && reviewGroups.length > 0 && <ImportReview groups={reviewGroups} onCancel={handleReset} onImport={handleImport} />}

      {state === "success" && importResult && (
        <div className="bank-statement-success">
          <div className="bank-statement-success-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h4 className="bank-statement-success-title">{t("import.success.title")}</h4>
          <ImportStats title={t("import.mainAccount")} result={importResult.actual} />
          <div style={{ marginTop: "1rem" }}>
            <ImportStats
              title={
                <>
                  {t("import.savingsAccount")}
                  {importResult.depositAccountCreated && (
                    <span style={{ color: "var(--accent)", marginLeft: "0.5rem" }}>({t("import.success.created")})</span>
                  )}
                </>
              }
              result={importResult.deposit}
            />
          </div>
          {transfersTagged > 0 && (
            <p style={{ fontSize: "0.85rem", color: "var(--gris-claro)", marginTop: "1rem", textAlign: "center" }}>
              {interpolate(t("import.success.transfers"), { n: transfersTagged })}
            </p>
          )}
          <Button variant="outline" onClick={handleReset} style={{ marginTop: "1rem" }}>
            {t("import.success.another")}
          </Button>
        </div>
      )}

      {state === "error" && (
        <div className="bank-statement-error">
          <div className="bank-statement-error-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h4 className="bank-statement-error-title">{t("import.error.title")}</h4>
          <p className="bank-statement-error-message">{error}</p>
          <Button variant="outline" onClick={handleReset}>
            {t("import.error.retry")}
          </Button>
        </div>
      )}
    </div>
  );
}
