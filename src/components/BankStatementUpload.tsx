"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getBankProvider, type BankProvider } from "@/lib/bankProviders";
import { parseTradeRepublicPDF } from "@/lib/parsers/tradeRepublic";
import { parseRevolutCSV, parseRevolutExcel, normalizeRevolutTransactions } from "@/lib/parsers/revolut";
import { parseBBVAExcel, normalizeBBVATransactions } from "@/lib/parsers/bbva";
import { parseImaginCSV, normalizeImaginTransactions } from "@/lib/parsers/imagin";
import { normalizeAndHashTransactions } from "@/lib/parsers/utils";
import type { ImportedTransaction, ImportTransactionsResponse, PossibleDuplicate } from "@/lib/parsers/types";
import { SensitiveAmount } from "@/components/SensitiveAmount";

interface BankStatementUploadProps {
  accountId: string;
  bankProvider: BankProvider;
  onSuccess?: (result: ImportTransactionsResponse) => void;
  autoOpenFilePicker?: boolean;
}

type UploadState = "idle" | "parsing" | "preview" | "importing" | "success" | "error";

interface MultiAccountImportResult {
  actual?: ImportTransactionsResponse;
  deposit?: ImportTransactionsResponse;
  depositAccountCreated?: boolean;
  /** Cuenta remunerada Revolut (para decisiones de duplicados). */
  depositAccountId?: string;
}

type DuplicateWithAccount = PossibleDuplicate & { accountId: string };

interface DuplicatesReviewProps {
  actualDuplicates: DuplicateWithAccount[];
  depositDuplicates: DuplicateWithAccount[];
  lang: "es" | "en";
  formatCurrency: (n: number) => string;
  formatDate: (d: string) => string;
  onDuplicateRemoved: () => void;
}

function DuplicatesReview({ 
  actualDuplicates, 
  depositDuplicates, 
  lang, 
  formatCurrency, 
  formatDate,
  onDuplicateRemoved 
}: DuplicatesReviewProps) {
  const [dismissedPairs, setDismissedPairs] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<string | null>(null);

  const getPairKey = (dup: DuplicateWithAccount) => `${dup.accountId}-${dup.incoming.id}-${dup.existing.id}`;

  async function saveDuplicateDecision(
    accountId: string,
    conflictKey: string,
    resolution: "keep_existing" | "keep_import"
  ) {
    await fetch("/api/import/duplicate-decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: accountId, conflict_key: conflictKey, resolution }),
    });
  }

  async function clearDuplicateDecision(accountId: string, conflictKey: string) {
    const params = new URLSearchParams({ account_id: accountId, conflict_key: conflictKey });
    await fetch(`/api/import/duplicate-decisions?${params.toString()}`, { method: "DELETE" });
  }

  const handleRemoveTransaction = async (
    transactionId: string,
    pairKey: string,
    options?: { accountId?: string; conflictKey?: string; resolution?: "keep_existing" | "keep_import" }
  ) => {
    setRemoving(transactionId);
    try {
      const res = await fetch(`/api/crud/transactions/${transactionId}?skip_balance_adjust=1`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (options?.accountId && options?.conflictKey && options?.resolution) {
          await saveDuplicateDecision(options.accountId, options.conflictKey, options.resolution);
        }
        setDismissedPairs(prev => new Set([...prev, pairKey]));
        onDuplicateRemoved();
      }
    } catch (error) {
      console.error("Failed to remove transaction:", error);
    } finally {
      setRemoving(null);
    }
  };

  const handleKeepBoth = async (
    dup: DuplicateWithAccount & { accountLabel?: string },
    pairKey: string
  ) => {
    try {
      await clearDuplicateDecision(dup.accountId, dup.conflict_key);
    } catch (e) {
      console.error(e);
    }
    setDismissedPairs(prev => new Set([...prev, pairKey]));
  };

  type DupRow = DuplicateWithAccount & { accountLabel: string };

  const allDuplicates: DupRow[] = [
    ...actualDuplicates.map((d) => ({
      ...d,
      accountLabel: lang === "es" ? "Cuenta Principal" : "Main Account",
    })),
    ...depositDuplicates.map((d) => ({
      ...d,
      accountLabel: lang === "es" ? "Cuenta Remunerada" : "Savings Account",
    })),
  ].filter((d) => !dismissedPairs.has(getPairKey(d)));

  const [bulkAction, setBulkAction] = useState<"undo" | "remove_existing" | "keep_all" | null>(null);

  const handleBulkUndoAll = async () => {
    if (allDuplicates.length === 0) return;
    setBulkAction("undo");
    try {
      for (const d of allDuplicates) {
        const res = await fetch(
          `/api/crud/transactions/${d.incoming.id}?skip_balance_adjust=1`,
          { method: "DELETE" }
        );
        if (res.ok) {
          await saveDuplicateDecision(d.accountId, d.conflict_key, "keep_existing");
        }
      }
      setDismissedPairs(prev => new Set([...prev, ...allDuplicates.map(d => getPairKey(d))]));
      onDuplicateRemoved();
    } catch (error) {
      console.error("Bulk undo failed:", error);
    } finally {
      setBulkAction(null);
    }
  };

  const handleBulkRemoveAllExisting = async () => {
    if (allDuplicates.length === 0) return;
    setBulkAction("remove_existing");
    try {
      for (const d of allDuplicates) {
        const res = await fetch(
          `/api/crud/transactions/${d.existing.id}?skip_balance_adjust=1`,
          { method: "DELETE" }
        );
        if (res.ok) {
          await saveDuplicateDecision(d.accountId, d.conflict_key, "keep_import");
        }
      }
      setDismissedPairs(prev => new Set([...prev, ...allDuplicates.map(d => getPairKey(d))]));
      onDuplicateRemoved();
    } catch (error) {
      console.error("Bulk remove existing failed:", error);
    } finally {
      setBulkAction(null);
    }
  };

  const handleBulkKeepAll = async () => {
    try {
      for (const d of allDuplicates) {
        await clearDuplicateDecision(d.accountId, d.conflict_key);
      }
    } catch (e) {
      console.error(e);
    }
    setDismissedPairs(prev => new Set([...prev, ...allDuplicates.map(d => getPairKey(d))]));
  };

  if (allDuplicates.length === 0) {
    return null;
  }

  return (
    <div className="duplicates-review-container">
      <div className="duplicates-review-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>
          {lang === "es" ? "Posibles duplicados detectados" : "Possible duplicates detected"}
        </span>
      </div>
      
      <p className="duplicates-review-description">
        {lang === "es" 
          ? "Se han detectado transacciones con la misma fecha y cantidad. Revisa y decide qué hacer con cada una."
          : "Transactions with the same date and amount were detected. Review and decide what to do with each one."}
      </p>
      
      <div className="duplicates-review-bulk-actions">
        <span className="duplicates-review-bulk-label">
          {lang === "es" ? "Aplicar a todos:" : "Apply to all:"}
        </span>
        <div className="duplicate-card-actions">
          <button
            type="button"
            className="duplicate-btn duplicate-btn-undo"
            onClick={handleBulkUndoAll}
            disabled={bulkAction !== null}
          >
            {bulkAction === "undo" ? (
              <Spinner className="size-3" />
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                {lang === "es" ? "Deshacer todas las importaciones" : "Undo all imports"}
              </>
            )}
          </button>
          <button
            type="button"
            className="duplicate-btn duplicate-btn-remove"
            onClick={handleBulkRemoveAllExisting}
            disabled={bulkAction !== null}
          >
            {bulkAction === "remove_existing" ? (
              <Spinner className="size-3" />
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                {lang === "es" ? "Eliminar todas las existentes" : "Remove all existing"}
              </>
            )}
          </button>
          <button
            type="button"
            className="duplicate-btn duplicate-btn-keep"
            onClick={handleBulkKeepAll}
            disabled={bulkAction !== null}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            {lang === "es" ? "Mantener ambas en todos" : "Keep both for all"}
          </button>
        </div>
      </div>
      
      <div className="duplicates-review-list">
        {allDuplicates.map((dup, idx) => (
          <div key={idx} className="duplicate-card">
            <div className="duplicate-card-meta">
              <span className="duplicate-card-account">{dup.accountLabel}</span>
              <span className="duplicate-card-date">{formatDate(dup.incoming.date)}</span>
            </div>
            
            <div className="duplicate-card-comparison">
              <div className="duplicate-card-side duplicate-card-existing">
                <div className="duplicate-card-label">
                  {lang === "es" ? "YA EXISTENTE" : "ALREADY EXISTS"}
                </div>
                <div className="duplicate-card-desc">{dup.existing.description}</div>
                <div className="duplicate-card-amount">
                  <SensitiveAmount>{formatCurrency(dup.existing.amount)}</SensitiveAmount>
                </div>
              </div>
              
              <div className="duplicate-card-divider" />
              
              <div className="duplicate-card-side duplicate-card-new">
                <div className="duplicate-card-label">
                  {lang === "es" ? "NUEVA IMPORTADA" : "NEW IMPORTED"}
                </div>
                <div className="duplicate-card-desc">{dup.incoming.description}</div>
                <div className="duplicate-card-amount">
                  <SensitiveAmount>{formatCurrency(dup.incoming.amount)}</SensitiveAmount>
                </div>
              </div>
            </div>
            
            <div className="duplicate-card-actions">
              <button
                type="button"
                className="duplicate-btn duplicate-btn-undo"
                onClick={() =>
                  handleRemoveTransaction(dup.incoming.id, getPairKey(dup), {
                    accountId: dup.accountId,
                    conflictKey: dup.conflict_key,
                    resolution: "keep_existing",
                  })
                }
                disabled={removing !== null}
              >
                {removing === dup.incoming.id ? (
                  <Spinner className="size-3" />
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    {lang === "es" ? "Deshacer importación" : "Undo import"}
                  </>
                )}
              </button>
              <button
                type="button"
                className="duplicate-btn duplicate-btn-remove"
                onClick={() =>
                  handleRemoveTransaction(dup.existing.id, getPairKey(dup), {
                    accountId: dup.accountId,
                    conflictKey: dup.conflict_key,
                    resolution: "keep_import",
                  })
                }
                disabled={removing !== null}
              >
                {removing === dup.existing.id ? (
                  <Spinner className="size-3" />
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    {lang === "es" ? "Eliminar existente" : "Remove existing"}
                  </>
                )}
              </button>
              <button
                type="button"
                className="duplicate-btn duplicate-btn-keep"
                onClick={() => handleKeepBoth(dup, getPairKey(dup))}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                {lang === "es" ? "Mantener ambas" : "Keep both"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BankStatementUpload({
  accountId,
  bankProvider,
  onSuccess,
  autoOpenFilePicker = false,
}: BankStatementUploadProps) {
  const lang = useLang();
  const t = useTranslations(lang);
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoOpenAttemptedRef = useRef(false);

  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [statusMessage, setStatusMessage] = useState("");
  const [transactions, setTransactions] = useState<ImportedTransaction[]>([]);
  const [depositTransactions, setDepositTransactions] = useState<ImportedTransaction[]>([]);
  const [finalBalance, setFinalBalance] = useState<number | null>(null);
  const [depositBalance, setDepositBalance] = useState<number | null>(null);
  const [importResult, setImportResult] = useState<MultiAccountImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const bank = getBankProvider(bankProvider);
  if (!bank) return null;

  const acceptedFormats = bank.acceptedFormats.join(",");

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setState("parsing");
      setStatusMessage(lang === "es" ? "Procesando archivo..." : "Processing file...");

      try {
        if (bankProvider === "trade_republic") {
          const result = await parseTradeRepublicPDF(file, {
            onProgress: (current, total) => setProgress({ current, total }),
            onStatus: setStatusMessage,
          });

          const normalized = await normalizeAndHashTransactions(result.cash, accountId);
          
          setTransactions(normalized);
          setFinalBalance(result.finalBalance ?? null);
          setState("preview");
          setStatusMessage("");
        } else if (bankProvider === "revolut") {
          const isCSV = file.name.toLowerCase().endsWith(".csv");
          
          const result = isCSV 
            ? await parseRevolutCSV(file, {
                onProgress: (current, total) => setProgress({ current, total }),
                onStatus: setStatusMessage,
              })
            : await parseRevolutExcel(file, {
                onProgress: (current, total) => setProgress({ current, total }),
                onStatus: setStatusMessage,
              });

          const normalizedActual = await normalizeRevolutTransactions(result.actualTransactions, accountId);
          setTransactions(normalizedActual);
          setFinalBalance(result.actualBalance ?? null);
          
          if (result.depositTransactions.length > 0) {
            const normalizedDeposit = await normalizeRevolutTransactions(result.depositTransactions, "pending_deposit_account");
            setDepositTransactions(normalizedDeposit);
            setDepositBalance(result.depositBalance ?? null);
          } else {
            setDepositTransactions([]);
            setDepositBalance(null);
          }
          
          setState("preview");
          setStatusMessage("");
        } else if (bankProvider === "bbva") {
          const result = await parseBBVAExcel(file, {
            onProgress: (current, total) => setProgress({ current, total }),
            onStatus: setStatusMessage,
          });

          const normalized = await normalizeBBVATransactions(result.transactions, accountId);

          setTransactions(normalized);
          setFinalBalance(result.finalBalance ?? null);
          setState("preview");
          setStatusMessage("");
        } else if (bankProvider === "imagin") {
          const result = await parseImaginCSV(file, {
            onProgress: (current, total) => setProgress({ current, total }),
            onStatus: setStatusMessage,
          });

          const normalized = await normalizeImaginTransactions(result.transactions, accountId);

          setTransactions(normalized);
          setFinalBalance(result.finalBalance ?? null);
          setState("preview");
          setStatusMessage("");
        } else {
          setError(lang === "es" ? "Parser no implementado para este banco" : "Parser not implemented for this bank");
          setState("error");
        }
      } catch (err) {
        console.error("Parse error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setState("error");
      }
    },
    [accountId, bankProvider, lang]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleImport = async () => {
    if (transactions.length === 0 && depositTransactions.length === 0) return;

    setState("importing");
    setStatusMessage(lang === "es" ? "Importando transacciones..." : "Importing transactions...");

    try {
      const result: MultiAccountImportResult = {};

      if (transactions.length > 0) {
        const response = await fetch("/api/import/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account_id: accountId,
            transactions,
            final_balance: finalBalance,
          }),
        });

        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error || "Import failed");
        }
        result.actual = json.data as ImportTransactionsResponse;
      }

      if (depositTransactions.length > 0) {
        setStatusMessage(lang === "es" ? "Importando cuenta remunerada..." : "Importing savings account...");
        
        const response = await fetch("/api/import/revolut-deposit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parent_account_id: accountId,
            transactions: depositTransactions,
            final_balance: depositBalance,
          }),
        });

        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error || "Deposit import failed");
        }
        result.deposit = json.data.importResult as ImportTransactionsResponse;
        result.depositAccountCreated = json.data.accountCreated;
        result.depositAccountId = json.data.accountId as string;
      }

      setImportResult(result);
      setState("success");

      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      
      router.refresh();

      if (result.actual) {
        onSuccess?.(result.actual);
      }
    } catch (err) {
      console.error("Import error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  };

  const handleReset = () => {
    setState("idle");
    setTransactions([]);
    setDepositTransactions([]);
    setFinalBalance(null);
    setDepositBalance(null);
    setImportResult(null);
    setError(null);
    setStatusMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatCurrency = (n: number) => {
    return new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + " €";
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const locale = lang === "es" ? "es-ES" : "en-US";
    const hasTime =
      /T\d{2}:\d{2}/.test(dateStr) ||
      (dateStr.length > 10 && /\d{2}:\d{2}/.test(dateStr));
    if (hasTime) {
      return d.toLocaleString(locale, { dateStyle: "short", timeStyle: "medium" });
    }
    return d.toLocaleDateString(locale);
  };

  useEffect(() => {
    if (!autoOpenFilePicker || autoOpenAttemptedRef.current || state !== "idle") return;
    autoOpenAttemptedRef.current = true;
    const timer = window.setTimeout(() => {
      fileInputRef.current?.click();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [autoOpenFilePicker, state]);

  return (
    <div className="bank-statement-upload">
      <div className="bank-statement-upload-header">
        <img src={bank.icon} alt={bank.name} className="bank-statement-upload-icon" />
        <div>
          <h3 className="bank-statement-upload-title">
            {lang === "es" ? "Importar Extracto" : "Import Statement"}
          </h3>
          <p className="bank-statement-upload-subtitle">
            {bank.name} ({bank.formatLabel})
          </p>
        </div>
      </div>

      {state === "idle" && (
        <div
          className={`bank-statement-dropzone ${isDragOver ? "drag-over" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFormats}
            onChange={handleFileInput}
            className="hidden"
          />
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="bank-statement-dropzone-icon"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="bank-statement-dropzone-text">
            {lang === "es"
              ? "Arrastra tu extracto aquí o haz clic para seleccionar"
              : "Drag your statement here or click to select"}
          </p>
          <p className="bank-statement-dropzone-hint">
            {lang === "es" ? `Formato: ${bank.formatLabel}` : `Format: ${bank.formatLabel}`}
          </p>
        </div>
      )}

      {state === "parsing" && (
        <div className="bank-statement-progress">
          <Spinner className="size-8" />
          <p className="bank-statement-progress-text">{statusMessage}</p>
          {progress.total > 0 && (
            <p className="bank-statement-progress-pages">
              {lang === "es" ? "Página" : "Page"} {progress.current} / {progress.total}
            </p>
          )}
        </div>
      )}

      {state === "preview" && (
        <div className="bank-statement-preview">
          <div className="bank-statement-preview-actions">
            <Button 
              variant="outline" 
              onClick={handleReset}
              className="border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              {lang === "es" ? "Cancelar" : "Cancel"}
            </Button>
            <Button onClick={handleImport}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {lang === "es" ? "Importar" : "Import"} ({transactions.length + depositTransactions.length})
            </Button>
          </div>

          {transactions.length > 0 && (
            <>
              <div className="bank-statement-preview-header">
                <h4>
                  {lang === "es" ? "Cuenta Actual" : "Main Account"}: {transactions.length} {lang === "es" ? "transacciones" : "transactions"}
                </h4>
              </div>
              <div className="bank-statement-preview-list">
                {transactions.slice(0, 5).map((tx, idx) => (
                  <div key={idx} className={`bank-statement-preview-item ${tx.type}`}>
                    <div className="bank-statement-preview-item-left">
                      <span className="bank-statement-preview-date">{formatDate(tx.date)}</span>
                      <span className="bank-statement-preview-desc">{tx.description}</span>
                    </div>
                    <span className={`bank-statement-preview-amount ${tx.type}`}>
                      {tx.type === "income" ? "+" : "-"}
                      <SensitiveAmount>{formatCurrency(tx.amount)}</SensitiveAmount>
                    </span>
                  </div>
                ))}
                {transactions.length > 5 && (
                  <p className="bank-statement-preview-more">
                    {lang === "es"
                      ? `... y ${transactions.length - 5} más`
                      : `... and ${transactions.length - 5} more`}
                  </p>
                )}
              </div>
            </>
          )}
          
          {depositTransactions.length > 0 && (
            <>
              <div className="bank-statement-preview-header" style={{ marginTop: transactions.length > 0 ? "1rem" : 0 }}>
                <h4>
                  {lang === "es" ? "Cuenta Remunerada" : "Savings Account"}: {depositTransactions.length} {lang === "es" ? "transacciones" : "transactions"}
                </h4>
                <p style={{ fontSize: "0.8rem", color: "var(--gris-claro)", marginTop: "0.25rem" }}>
                  {lang === "es" ? "Se importará a 'Revolut Remunerada'" : "Will be imported to 'Revolut Savings'"}
                </p>
              </div>
              <div className="bank-statement-preview-list">
                {depositTransactions.slice(0, 5).map((tx, idx) => (
                  <div key={`dep-${idx}`} className={`bank-statement-preview-item ${tx.type}`}>
                    <div className="bank-statement-preview-item-left">
                      <span className="bank-statement-preview-date">{formatDate(tx.date)}</span>
                      <span className="bank-statement-preview-desc">{tx.description}</span>
                    </div>
                    <span className={`bank-statement-preview-amount ${tx.type}`}>
                      {tx.type === "income" ? "+" : "-"}
                      <SensitiveAmount>{formatCurrency(tx.amount)}</SensitiveAmount>
                    </span>
                  </div>
                ))}
                {depositTransactions.length > 5 && (
                  <p className="bank-statement-preview-more">
                    {lang === "es"
                      ? `... y ${depositTransactions.length - 5} más`
                      : `... and ${depositTransactions.length - 5} more`}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {state === "importing" && (
        <div className="bank-statement-progress">
          <Spinner className="size-8" />
          <p className="bank-statement-progress-text">{statusMessage}</p>
        </div>
      )}

      {state === "success" && importResult && (
        <div className="bank-statement-success">
          <div className="bank-statement-success-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h4 className="bank-statement-success-title">
            {lang === "es" ? "Importación completada" : "Import completed"}
          </h4>
          
          {importResult.actual && (
            <div className="bank-statement-success-stats">
              <p style={{ fontSize: "0.85rem", color: "var(--gris-claro)", marginBottom: "0.5rem", width: "100%", textAlign: "center" }}>
                {lang === "es" ? "Cuenta Actual" : "Main Account"}
              </p>
              <div className="bank-statement-success-stat">
                <span className="bank-statement-success-stat-value">{importResult.actual.imported}</span>
                <span className="bank-statement-success-stat-label">
                  {lang === "es" ? "Importadas" : "Imported"}
                </span>
              </div>
              <div className="bank-statement-success-stat">
                <span className="bank-statement-success-stat-value">{importResult.actual.skipped}</span>
                <span className="bank-statement-success-stat-label">
                  {lang === "es" ? "Duplicadas" : "Duplicates"}
                </span>
              </div>
            </div>
          )}
          
          {importResult.deposit && (
            <div className="bank-statement-success-stats" style={{ marginTop: "1rem" }}>
              <p style={{ fontSize: "0.85rem", color: "var(--gris-claro)", marginBottom: "0.5rem", width: "100%", textAlign: "center" }}>
                {lang === "es" ? "Cuenta Remunerada" : "Savings Account"}
                {importResult.depositAccountCreated && (
                  <span style={{ color: "var(--accent)", marginLeft: "0.5rem" }}>
                    ({lang === "es" ? "creada" : "created"})
                  </span>
                )}
              </p>
              <div className="bank-statement-success-stat">
                <span className="bank-statement-success-stat-value">{importResult.deposit.imported}</span>
                <span className="bank-statement-success-stat-label">
                  {lang === "es" ? "Importadas" : "Imported"}
                </span>
              </div>
              <div className="bank-statement-success-stat">
                <span className="bank-statement-success-stat-value">{importResult.deposit.skipped}</span>
                <span className="bank-statement-success-stat-label">
                  {lang === "es" ? "Duplicadas" : "Duplicates"}
                </span>
              </div>
            </div>
          )}
          
          {((importResult.actual?.possibleDuplicates?.length ?? 0) > 0 || (importResult.deposit?.possibleDuplicates?.length ?? 0) > 0) && (
            <DuplicatesReview 
              actualDuplicates={(importResult.actual?.possibleDuplicates || []).map((d) => ({
                ...d,
                accountId,
              }))}
              depositDuplicates={(importResult.deposit?.possibleDuplicates || [])
                .map((d) => ({
                  ...d,
                  accountId: importResult.depositAccountId ?? "",
                }))
                .filter((d) => d.accountId.length > 0)}
              lang={lang}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              onDuplicateRemoved={() => {
                queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
                queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
              }}
            />
          )}
          
          <Button variant="outline" onClick={handleReset} style={{ marginTop: "1rem" }}>
            {lang === "es" ? "Importar otro" : "Import another"}
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
          <h4 className="bank-statement-error-title">
            {lang === "es" ? "Error" : "Error"}
          </h4>
          <p className="bank-statement-error-message">{error}</p>
          <Button variant="outline" onClick={handleReset}>
            {lang === "es" ? "Reintentar" : "Try again"}
          </Button>
        </div>
      )}
    </div>
  );
}
