"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useLang } from "@/hooks/useLang";
import { api } from "@/lib/api";
import { BANK_PROVIDERS, type BankProvider } from "@/lib/bankProviders";
import { formatCurrency, localeOf } from "@/lib/format";
import { normalizeBBVATransactions, parseBBVAExcel } from "@/lib/parsers/bbva";
import { normalizeImaginTransactions, parseImaginCSV } from "@/lib/parsers/imagin";
import { normalizeRevolutTransactions, parseRevolutCSV, parseRevolutExcel } from "@/lib/parsers/revolut";
import { normalizeTradeRepublicTransactions, parseTradeRepublicPDF } from "@/lib/parsers/tradeRepublic";
import type { ImportedTransaction, ImportTransactionsResponse, PossibleDuplicate } from "@/lib/parsers/types";
import { queryKeys } from "@/lib/queryKeys";

type UploadState = "idle" | "parsing" | "preview" | "importing" | "success" | "error";
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

function formatStatementDate(dateStr: string, lang: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const hasTime = /T\d{2}:\d{2}/.test(dateStr) || (dateStr.length > 10 && /\d{2}:\d{2}/.test(dateStr));
  return hasTime ? d.toLocaleString(localeOf(lang), { dateStyle: "short", timeStyle: "medium" }) : d.toLocaleDateString(localeOf(lang));
}

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

type Duplicate = PossibleDuplicate & { accountId: string; accountLabel: string };
/** keep_existing deletes the imported row, keep_import deletes the existing one, keep_both forgets any decision. */
type Resolution = "keep_existing" | "keep_import" | "keep_both";

/** Lets the user resolve manual-vs-imported duplicates one by one or all at once. */
function DuplicatesReview({ duplicates, onChanged }: { duplicates: Duplicate[]; onChanged: () => void }) {
  const lang = useLang();
  const es = lang === "es";
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const keyOf = (d: Duplicate) => `${d.accountId}-${d.incoming.id}-${d.existing.id}`;
  const pending = duplicates.filter((d) => !dismissed.has(keyOf(d)));

  const resolve = async (targets: Duplicate[], resolution: Resolution, busyKey: string) => {
    setBusy(busyKey);
    try {
      for (const d of targets) {
        if (resolution === "keep_both") {
          const params = new URLSearchParams({ account_id: d.accountId, conflict_key: d.conflict_key });
          await api(`/api/import/duplicate-decisions?${params}`, "DELETE");
          continue;
        }
        // The balance already reflects the statement, so deleting a twin must not adjust it.
        const toDelete = resolution === "keep_existing" ? d.incoming.id : d.existing.id;
        await api(`/api/crud/transactions/${toDelete}?skip_balance_adjust=1`, "DELETE");
        await api("/api/import/duplicate-decisions", "POST", { account_id: d.accountId, conflict_key: d.conflict_key, resolution });
      }
      setDismissed((prev) => new Set([...prev, ...targets.map(keyOf)]));
      if (resolution !== "keep_both") onChanged();
    } catch (error) {
      console.error("Duplicate resolution failed:", error);
    } finally {
      setBusy(null);
    }
  };

  if (pending.length === 0) return null;

  const actions = (targets: Duplicate[], id: string, labels: [string, string, string]) => (
    <div className="duplicate-card-actions">
      {(["keep_existing", "keep_import", "keep_both"] as const).map((resolution, i) => (
        <button
          key={resolution}
          type="button"
          className={`duplicate-btn duplicate-btn-${["undo", "remove", "keep"][i]}`}
          onClick={() => resolve(targets, resolution, `${id}-${resolution}`)}
          disabled={busy !== null}
        >
          {busy === `${id}-${resolution}` ? (
            <Spinner className="size-3" />
          ) : (
            <>
              {resolution === "keep_both" ? <CheckIcon /> : <TrashIcon />}
              {labels[i]}
            </>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <div className="duplicates-review-container">
      <div className="duplicates-review-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span>{es ? "Posibles duplicados detectados" : "Possible duplicates detected"}</span>
      </div>
      <p className="duplicates-review-description">
        {es
          ? "Se han detectado transacciones con la misma fecha y cantidad. Revisa y decide qué hacer con cada una."
          : "Transactions with the same date and amount were detected. Review and decide what to do with each one."}
      </p>
      <div className="duplicates-review-bulk-actions">
        <span className="duplicates-review-bulk-label">{es ? "Aplicar a todos:" : "Apply to all:"}</span>
        {actions(
          pending,
          "all",
          es
            ? ["Deshacer todas las importaciones", "Eliminar todas las existentes", "Mantener ambas en todos"]
            : ["Undo all imports", "Remove all existing", "Keep both for all"]
        )}
      </div>
      <div className="duplicates-review-list">
        {pending.map((dup) => (
          <div key={keyOf(dup)} className="duplicate-card">
            <div className="duplicate-card-meta">
              <span className="duplicate-card-account">{dup.accountLabel}</span>
              <span className="duplicate-card-date">{formatStatementDate(dup.incoming.date, lang)}</span>
            </div>
            <div className="duplicate-card-comparison">
              {([["existing", es ? "YA EXISTENTE" : "ALREADY EXISTS"], ["incoming", es ? "NUEVA IMPORTADA" : "NEW IMPORTED"]] as const).map(
                ([side, label], i) => (
                  <div key={side} className="contents">
                    {i === 1 && <div className="duplicate-card-divider" />}
                    <div className={`duplicate-card-side duplicate-card-${side === "existing" ? "existing" : "new"}`}>
                      <div className="duplicate-card-label">{label}</div>
                      <div className="duplicate-card-desc">{dup[side].description}</div>
                      <div className="duplicate-card-amount">
                        <SensitiveAmount>{formatCurrency(dup[side].amount)}</SensitiveAmount>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
            {actions([dup], keyOf(dup), es ? ["Deshacer importación", "Eliminar existente", "Mantener ambas"] : ["Undo import", "Remove existing", "Keep both"])}
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewList({ title, note, transactions }: { title: string; note?: string; transactions: ImportedTransaction[] }) {
  const lang = useLang();
  const es = lang === "es";
  if (transactions.length === 0) return null;
  return (
    <>
      <div className="bank-statement-preview-header">
        <h4>
          {title}: {transactions.length} {es ? "transacciones" : "transactions"}
        </h4>
        {note && <p style={{ fontSize: "0.8rem", color: "var(--gris-claro)", marginTop: "0.25rem" }}>{note}</p>}
      </div>
      <div className="bank-statement-preview-list">
        {transactions.slice(0, 5).map((tx, idx) => (
          <div key={idx} className={`bank-statement-preview-item ${tx.type}`}>
            <div className="bank-statement-preview-item-left">
              <span className="bank-statement-preview-date">{formatStatementDate(tx.date, lang)}</span>
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
            {es ? `... y ${transactions.length - 5} más` : `... and ${transactions.length - 5} more`}
          </p>
        )}
      </div>
    </>
  );
}

function ImportStats({ title, result }: { title: React.ReactNode; result?: ImportTransactionsResponse }) {
  const es = useLang() === "es";
  if (!result) return null;
  return (
    <div className="bank-statement-success-stats">
      <p style={{ fontSize: "0.85rem", color: "var(--gris-claro)", marginBottom: "0.5rem", width: "100%", textAlign: "center" }}>{title}</p>
      {([[result.imported, es ? "Importadas" : "Imported"], [result.skipped, es ? "Duplicadas" : "Duplicates"]] as const).map(([value, label]) => (
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
  const es = lang === "es";
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoOpenAttemptedRef = useRef(false);
  const bank = BANK_PROVIDERS[bankProvider];

  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [statusMessage, setStatusMessage] = useState("");
  const [parsed, setParsed] = useState<ParsedStatement | null>(null);
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
    setStatusMessage(es ? "Procesando archivo..." : "Processing file...");
    try {
      setParsed(
        await parseStatement(file, bankProvider, accountId, {
          onProgress: (current, total) => setProgress({ current, total }),
          onStatus: setStatusMessage,
        })
      );
      setState("preview");
      setStatusMessage("");
    } catch (err) {
      fail(err);
    }
  };

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
    ]);

  const handleImport = async () => {
    if (!parsed) return;
    setState("importing");
    setStatusMessage(es ? "Importando transacciones..." : "Importing transactions...");
    try {
      const result: ImportResult = {};
      if (parsed.transactions.length > 0) {
        result.actual = await api("/api/import/transactions", "POST", {
          account_id: accountId,
          transactions: parsed.transactions,
          final_balance: parsed.finalBalance,
        });
      }
      if (parsed.deposit.length > 0) {
        setStatusMessage(es ? "Importando cuenta remunerada..." : "Importing savings account...");
        const data = await api("/api/import/revolut-deposit", "POST", {
          parent_account_id: accountId,
          transactions: parsed.deposit,
          final_balance: parsed.depositBalance,
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
    setImportResult(null);
    setError(null);
    setStatusMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const duplicates: Duplicate[] = importResult
    ? [
        ...(importResult.actual?.possibleDuplicates ?? []).map((d) => ({ ...d, accountId, accountLabel: es ? "Cuenta Principal" : "Main Account" })),
        ...(importResult.depositAccountId ? (importResult.deposit?.possibleDuplicates ?? []) : []).map((d) => ({
          ...d,
          accountId: importResult.depositAccountId!,
          accountLabel: es ? "Cuenta Remunerada" : "Savings Account",
        })),
      ]
    : [];
  const transfersTagged = (importResult?.actual?.internal_transfers_tagged ?? 0) + (importResult?.deposit?.internal_transfers_tagged ?? 0);
  const total = (parsed?.transactions.length ?? 0) + (parsed?.deposit.length ?? 0);

  return (
    <div className="bank-statement-upload">
      <div className="bank-statement-upload-header">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote brand logo */}
        <img src={bank.icon} alt={bank.name} className="bank-statement-upload-icon" />
        <div>
          <h3 className="bank-statement-upload-title">{es ? "Importar Extracto" : "Import Statement"}</h3>
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
          <p className="bank-statement-dropzone-text">
            {es ? "Arrastra tu extracto aquí o haz clic para seleccionar" : "Drag your statement here or click to select"}
          </p>
          <p className="bank-statement-dropzone-hint">
            {es ? "Formato" : "Format"}: {bank.formatLabel}
          </p>
        </div>
      )}

      {(state === "parsing" || state === "importing") && (
        <div className="bank-statement-progress">
          <Spinner className="size-8" />
          <p className="bank-statement-progress-text">{statusMessage}</p>
          {state === "parsing" && progress.total > 0 && (
            <p className="bank-statement-progress-pages">
              {es ? "Página" : "Page"} {progress.current} / {progress.total}
            </p>
          )}
        </div>
      )}

      {state === "preview" && parsed && (
        <div className="bank-statement-preview">
          <div className="bank-statement-preview-actions">
            <Button
              variant="outline"
              onClick={handleReset}
              className="border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              {es ? "Cancelar" : "Cancel"}
            </Button>
            <Button onClick={handleImport} disabled={total === 0}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {es ? "Importar" : "Import"} ({total})
            </Button>
          </div>
          <PreviewList title={es ? "Cuenta Actual" : "Main Account"} transactions={parsed.transactions} />
          <div style={{ marginTop: parsed.transactions.length > 0 && parsed.deposit.length > 0 ? "1rem" : 0 }}>
            <PreviewList
              title={es ? "Cuenta Remunerada" : "Savings Account"}
              note={es ? "Se importará a 'Revolut Remunerada'" : "Will be imported to 'Revolut Savings'"}
              transactions={parsed.deposit}
            />
          </div>
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
          <h4 className="bank-statement-success-title">{es ? "Importación completada" : "Import completed"}</h4>
          <ImportStats title={es ? "Cuenta Actual" : "Main Account"} result={importResult.actual} />
          <div style={{ marginTop: "1rem" }}>
            <ImportStats
              title={
                <>
                  {es ? "Cuenta Remunerada" : "Savings Account"}
                  {importResult.depositAccountCreated && (
                    <span style={{ color: "var(--accent)", marginLeft: "0.5rem" }}>({es ? "creada" : "created"})</span>
                  )}
                </>
              }
              result={importResult.deposit}
            />
          </div>
          {transfersTagged > 0 && (
            <p style={{ fontSize: "0.85rem", color: "var(--gris-claro)", marginTop: "1rem", textAlign: "center" }}>
              {es
                ? `${transfersTagged} movimientos detectados como traspasos entre tus cuentas y excluidos de métricas`
                : `${transfersTagged} transactions detected as transfers between your accounts and excluded from metrics`}
            </p>
          )}
          <DuplicatesReview duplicates={duplicates} onChanged={invalidate} />
          <Button variant="outline" onClick={handleReset} style={{ marginTop: "1rem" }}>
            {es ? "Importar otro" : "Import another"}
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
          <h4 className="bank-statement-error-title">Error</h4>
          <p className="bank-statement-error-message">{error}</p>
          <Button variant="outline" onClick={handleReset}>
            {es ? "Reintentar" : "Try again"}
          </Button>
        </div>
      )}
    </div>
  );
}
