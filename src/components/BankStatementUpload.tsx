"use client";

import { useState, useCallback, useRef } from "react";
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
import { normalizeAndHashTransactions } from "@/lib/parsers/utils";
import type { ImportedTransaction, ImportTransactionsResponse } from "@/lib/parsers/types";

interface BankStatementUploadProps {
  accountId: string;
  bankProvider: BankProvider;
  onSuccess?: (result: ImportTransactionsResponse) => void;
}

type UploadState = "idle" | "parsing" | "preview" | "importing" | "success" | "error";

export default function BankStatementUpload({
  accountId,
  bankProvider,
  onSuccess,
}: BankStatementUploadProps) {
  const lang = useLang();
  const t = useTranslations(lang);
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [statusMessage, setStatusMessage] = useState("");
  const [transactions, setTransactions] = useState<ImportedTransaction[]>([]);
  const [finalBalance, setFinalBalance] = useState<number | null>(null);
  const [importResult, setImportResult] = useState<ImportTransactionsResponse | null>(null);
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

          const normalized = await normalizeRevolutTransactions(result.transactions, accountId);
          
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
    if (transactions.length === 0) return;

    setState("importing");
    setStatusMessage(lang === "es" ? "Importando transacciones..." : "Importing transactions...");

    try {
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

      const result = json.data as ImportTransactionsResponse;
      setImportResult(result);
      setState("success");

      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      
      router.refresh();

      onSuccess?.(result);
    } catch (err) {
      console.error("Import error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  };

  const handleReset = () => {
    setState("idle");
    setTransactions([]);
    setFinalBalance(null);
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
    return d.toLocaleDateString(lang === "es" ? "es-ES" : "en-US");
  };

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
          <div className="bank-statement-preview-header">
            <h4>
              {lang === "es" ? "Transacciones encontradas" : "Transactions found"}: {transactions.length}
            </h4>
          </div>
          <div className="bank-statement-preview-list">
            {transactions.slice(0, 10).map((tx, idx) => (
              <div key={idx} className={`bank-statement-preview-item ${tx.type}`}>
                <div className="bank-statement-preview-item-left">
                  <span className="bank-statement-preview-date">{formatDate(tx.date)}</span>
                  <span className="bank-statement-preview-desc">{tx.description}</span>
                </div>
                <span className={`bank-statement-preview-amount ${tx.type}`}>
                  {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
            {transactions.length > 10 && (
              <p className="bank-statement-preview-more">
                {lang === "es"
                  ? `... y ${transactions.length - 10} transacciones más`
                  : `... and ${transactions.length - 10} more transactions`}
              </p>
            )}
          </div>
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
              {lang === "es" ? "Importar" : "Import"} ({transactions.length})
            </Button>
          </div>
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
          <div className="bank-statement-success-stats">
            <div className="bank-statement-success-stat">
              <span className="bank-statement-success-stat-value">{importResult.imported}</span>
              <span className="bank-statement-success-stat-label">
                {lang === "es" ? "Importadas" : "Imported"}
              </span>
            </div>
            <div className="bank-statement-success-stat">
              <span className="bank-statement-success-stat-value">{importResult.skipped}</span>
              <span className="bank-statement-success-stat-label">
                {lang === "es" ? "Duplicadas" : "Duplicates"}
              </span>
            </div>
          </div>
          <Button variant="outline" onClick={handleReset}>
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
