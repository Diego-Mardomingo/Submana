"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, FileUp, ListX, Plus, SquarePen, Star, Trash2 } from "lucide-react";
import { AccountDeleteWarning, AccountSheet, CardIcon } from "@/components/AccountSheet";
import BankStatementUpload from "@/components/BankStatementUpload";
import { ConfirmDeleteSheet } from "@/components/ConfirmSheet";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { FieldGroup, FieldStack, FormError, Segmented, SheetButton } from "@/components/SheetFields";
import { signed, TransactionDayList } from "@/components/TransactionDayList";
import { TransactionSheet } from "@/components/TransactionSheet";
import { Sheet, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { useAccounts, useDeleteAccount, useDeleteAccountTransactions, type Account } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { useSwipe } from "@/hooks/useSwipe";
import { useTransactions, type Transaction } from "@/hooks/useTransactions";
import { getBankProvider, type BankProvider } from "@/lib/bankProviders";
import { appNow, calendarDayInAppTimeZone, monthKey, shiftMonth } from "@/lib/date";
import { formatCurrency, monthKeyLabel, monthName } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { metricTransactions, sumByType } from "@/lib/metricsFilters";
import { cn } from "@/lib/utils";

const IMPORTABLE_PROVIDERS = ["trade_republic", "revolut", "bbva", "imagin"];

/** "YYYY-MM" of a transaction, in the app's time zone (same as its day group). */
const txMonthKey = (tx: Transaction) => calendarDayInAppTimeZone(tx.date).slice(0, 7);

/** Months with transactions laid out by year: tap the first month, then the last one. */
function MonthRangePicker({ counts, range, onChange }: {
  counts: Map<string, number>;
  range: { start: string; end: string; picking: boolean };
  onChange: (range: { start: string; end: string; picking: boolean }) => void;
}) {
  const lang = useLang();
  const es = lang === "es";
  const keys = [...counts.keys()].sort();
  const firstYear = Number(keys[0]?.slice(0, 4));
  const lastYear = Number(keys.at(-1)?.slice(0, 4));
  const years = keys.length ? Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i) : [];
  const pick = (key: string) =>
    onChange(
      range.picking
        ? { start: key < range.start ? key : range.start, end: key < range.start ? range.start : key, picking: false }
        : { start: key, end: key, picking: true }
    );

  return (
    <>
      <FieldStack>
        <div className="sf-months-summary">
          <div className="sf-months-edge">
            <span className="lp-label">{es ? "Desde" : "From"}</span>
            <strong>{monthKeyLabel(range.start, lang, "long")}</strong>
          </div>
          <ChevronRight className="sf-months-arrow size-4" aria-hidden />
          <div className={cn("sf-months-edge", range.picking && "is-pending")}>
            <span className="lp-label">{es ? "Hasta" : "To"}</span>
            <strong>{range.picking ? (es ? "Elige el último" : "Pick the last") : monthKeyLabel(range.end, lang, "long")}</strong>
          </div>
        </div>
      </FieldStack>
      <FieldStack>
        {years.map((year) => (
          <div key={year} className="sf-months-year">
            <span className="sf-months-year-label">{year}</span>
            <div className="sf-months-grid">
              {Array.from({ length: 12 }, (_, i) => {
                const key = monthKey(year, i + 1);
                const count = counts.get(key) ?? 0;
                const inRange = key >= range.start && key <= range.end;
                return (
                  <button
                    key={key}
                    type="button"
                    className={cn("sf-month", inRange && "in-range", key === range.start && "is-start", key === range.end && "is-end")}
                    disabled={count === 0}
                    aria-pressed={inRange}
                    aria-label={`${monthKeyLabel(key, lang, "long")}: ${count}`}
                    onClick={() => pick(key)}
                  >
                    {monthName(i + 1, lang)}
                    <small>{count}</small>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </FieldStack>
    </>
  );
}

/** "Delete transactions" sheet: all of them or a month range. */
function BulkDeleteSheet({ open, onOpenChange, accountId, transactions }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  transactions: Transaction[];
}) {
  const lang = useLang();
  const es = lang === "es";
  const t = useTranslations(lang);
  const router = useRouter();
  const deleteTransactions = useDeleteAccountTransactions();
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) map.set(txMonthKey(tx), (map.get(txMonthKey(tx)) ?? 0) + 1);
    return map;
  }, [transactions]);
  const keys = [...counts.keys()].sort();
  const [mode, setMode] = useState<"all" | "range">("all");
  const [picked, setPicked] = useState<{ start: string; end: string; picking: boolean } | null>(null);
  // Defaults to the latest month; months change after deleting, so fall back when one is gone.
  const range =
    picked && counts.has(picked.start) && (picked.picking || counts.has(picked.end))
      ? picked
      : { start: keys.at(-1) ?? "", end: keys.at(-1) ?? "", picking: false };
  const [error, setError] = useState(false);
  const count =
    mode === "all"
      ? transactions.length
      : range.picking
        ? 0
        : transactions.filter((tx) => txMonthKey(tx) >= range.start && txMonthKey(tx) <= range.end).length;

  const confirm = async () => {
    setError(false);
    const [startYear, startMonth] = range.start.split("-").map(Number);
    const [endYear, endMonth] = range.end.split("-").map(Number);
    try {
      await deleteTransactions.mutateAsync({
        accountId,
        payload: mode === "all" ? { mode } : { mode, startYear, startMonth, endYear, endMonth },
      });
      router.refresh();
      onOpenChange(false);
    } catch {
      setError(true);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("accounts.deleteTransactionsTitle")} description={es ? "El saldo de la cuenta se recalcula" : "The account balance is recalculated"}>
      <SheetBody>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "all", label: es ? "Todas" : "All" },
            { value: "range", label: es ? "Por meses" : "By month" },
          ]}
        />
        {mode === "range" && (
          <FieldGroup hint={es ? "Toca el primer mes y después el último. El número es la cantidad de movimientos." : "Tap the first month, then the last one. The number is how many transactions it has."}>
            <MonthRangePicker counts={counts} range={range} onChange={setPicked} />
          </FieldGroup>
        )}
        <div className="sf-confirm sf-confirm--danger ad-bulk-summary">
          <p className="sf-confirm-title">
            {range.picking && mode === "range"
              ? es
                ? "Elige el último mes del rango"
                : "Pick the last month of the range"
              : es
                ? `Se borrarán ${count} transacci${count === 1 ? "ón" : "ones"}`
                : `${count} transaction${count === 1 ? "" : "s"} will be deleted`}
          </p>
          <div className="sf-confirm-text">{es ? "Esta acción no se puede deshacer." : "This can't be undone."}</div>
        </div>
      </SheetBody>
      <SheetFooter>
        <FormError>{error && t("accounts.deleteTransactionsError")}</FormError>
        <SheetButton variant="danger" onClick={confirm} pending={deleteTransactions.isPending} disabled={count === 0}>
          <Trash2 aria-hidden />
          {es ? `Borrar ${count}` : `Delete ${count}`}
        </SheetButton>
      </SheetFooter>
    </Sheet>
  );
}

/** Account page: balance, month summary, actions, statement import and the month's transactions. */
export default function AccountDetail({ account: initialAccount }: { account: Account }) {
  const lang = useLang();
  const es = lang === "es";
  const t = useTranslations(lang);
  const router = useRouter();
  const searchParams = useSearchParams();
  const importRef = useRef<HTMLDivElement>(null);
  const [swipeArea, setSwipeArea] = useState<HTMLDivElement | null>(null);
  const autoUpload = searchParams.get("autoupload") === "1";
  const [importOpen, setImportOpen] = useState(searchParams.get("import") === "1" || autoUpload);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteAccount = useDeleteAccount();

  // Every transaction is needed anyway to detect transfers between accounts.
  const { data: allTransactions = [], isLoading: txLoading } = useTransactions();
  const { data: categories } = useCategories();
  const { data: accountsList } = useAccounts();
  // Cached copy first, so edits made in the sheet show up without reloading the page.
  const account = accountsList?.find((a) => a.id === initialAccount.id) ?? initialAccount;
  const accent = account.color || "var(--accent)";
  const bank = getBankProvider(account.bank_provider);
  const importable = !!account.bank_provider && IMPORTABLE_PROVIDERS.includes(account.bank_provider);

  const transactions = useMemo(() => allTransactions.filter((tx) => tx.account_id === account.id), [allTransactions, account.id]);
  const countedIds = useMemo(() => new Set(metricTransactions(allTransactions, categories).map((tx) => tx.id)), [allTransactions, categories]);

  // Month being looked at: from the first transaction's month up to the current one.
  const now = appNow();
  const currentKey = monthKey(now.getFullYear(), now.getMonth() + 1);
  const firstKey = transactions.reduce((min, tx) => (txMonthKey(tx) < min ? txMonthKey(tx) : min), currentKey);
  const [selected, setSelected] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const selectedKey = monthKey(selected.year, selected.month);
  const canPrev = selectedKey > firstKey;
  const canNext = selectedKey < currentKey;
  const changeMonth = (delta: number) => {
    const target = shiftMonth(selected.year, selected.month, delta);
    const key = monthKey(target.year, target.month);
    if (key >= firstKey && key <= currentKey) setSelected(target);
  };
  const goToToday = () => setSelected({ year: now.getFullYear(), month: now.getMonth() + 1 });

  useSwipe(swipeArea, { onSwipeLeft: () => changeMonth(1), onSwipeRight: () => changeMonth(-1) }, 50);
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.closest("[role=dialog]")) return;
    if (e.key === "ArrowLeft") changeMonth(-1);
    else if (e.key === "ArrowRight") changeMonth(1);
    else return;
    e.preventDefault();
  });
  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Coming from the "import" shortcut: show the import panel and drop the query string.
  useEffect(() => {
    if (!searchParams.get("import") && !autoUpload) return;
    importRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const timer = window.setTimeout(() => router.replace(`/account/${account.id}`, { scroll: false }), 350);
    return () => window.clearTimeout(timer);
  }, [searchParams, autoUpload, router, account.id]);

  const monthTxs = transactions.filter((tx) => txMonthKey(tx) === selectedKey);
  const counted = monthTxs.filter((tx) => countedIds.has(tx.id));
  const { income, expense } = sumByType(counted);
  const net = income - expense;
  const balance = Number(account.balance);
  const savings = account.name.toLowerCase().includes("remunerada");

  const toggleImport = () => {
    setImportOpen((open) => !open);
    if (!importOpen) requestAnimationFrame(() => importRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  return (
    <div className="page-container lp-page ad-page fade-in" style={{ "--account-accent": accent } as React.CSSProperties}>
      <header className="lp-header ad-header">
        <Link href="/accounts" className="ad-back" aria-label={t("accounts.title")}>
          <ChevronLeft className="size-5" strokeWidth={2.25} />
          <span>{t("accounts.title")}</span>
        </Link>
        <button type="button" className="add-btn lp-add" onClick={() => setEditOpen(true)} aria-label={t("common.edit")}>
          <SquarePen className="size-[18px]" strokeWidth={2.25} aria-hidden />
          <span className="lp-add-label">{t("common.edit")}</span>
        </button>
      </header>

      <div className="lp-layout">
        <aside className="lp-aside">
          <div className="lp-card ad-hero">
            <div className="ad-identity">
              <span className={cn("ad-icon", account.icon && "ad-icon--logo")}>
                {account.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote logos from arbitrary hosts
                  <img src={account.icon} alt="" />
                ) : (
                  <CardIcon size={26} strokeWidth={1.8} />
                )}
                {savings && (
                  <span className="lp-interest" title={es ? "Cuenta remunerada" : "Savings account"}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                      <polyline points="17 6 23 6 23 12" />
                    </svg>
                  </span>
                )}
              </span>
              <div className="ad-identity-text">
                <h1>{account.name}</h1>
                <div className="ad-tags">
                  {account.is_default && (
                    <span className="sf-badge sf-badge--star">
                      <Star fill="currentColor" aria-hidden />
                      {es ? "Por defecto" : "Default"}
                    </span>
                  )}
                  {bank && <span className="sf-badge">{bank.name}</span>}
                </div>
              </div>
            </div>
            <div className="ad-balance">
              <span className="lp-label">{es ? "Saldo actual" : "Current balance"}</span>
              <span className={cn("lp-hero-value", balance < 0 && "is-negative")}>
                <SensitiveAmount>{formatCurrency(balance)}</SensitiveAmount>
              </span>
            </div>
          </div>

          <div ref={setSwipeArea} className="lp-card lp-summary">
            <div className="lp-month">
              <button type="button" className="lp-icon-btn" onClick={() => changeMonth(-1)} disabled={!canPrev} aria-label={es ? "Mes anterior" : "Previous month"}>
                <ChevronLeft className="size-5" strokeWidth={2} />
              </button>
              <div className="lp-month-title">
                <span>{monthName(selected.month, lang, "long")}</span>
                <span className="lp-month-year">{selected.year}</span>
                {canNext && (
                  <button type="button" className="lp-chip" onClick={goToToday}>
                    {es ? "Hoy" : "Today"}
                  </button>
                )}
              </div>
              <button type="button" className="lp-icon-btn" onClick={() => changeMonth(1)} disabled={!canNext} aria-label={es ? "Mes siguiente" : "Next month"}>
                <ChevronRight className="size-5" strokeWidth={2} />
              </button>
            </div>
            {txLoading ? (
              <div className="lp-stats" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="lp-stat">
                    <div className="skeleton" style={{ height: 9, width: "60%" }} />
                    <div className="skeleton" style={{ height: 16, width: "80%", marginTop: 4 }} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="lp-stats lp-fade" key={selectedKey}>
                <div className="lp-stat">
                  <span className="lp-label">{es ? "Ingresos" : "Income"}</span>
                  <span className={cn("lp-stat-value", income > 0 ? "is-income" : "is-muted")}>
                    <SensitiveAmount>{formatCurrency(income)}</SensitiveAmount>
                  </span>
                </div>
                <div className="lp-stat">
                  <span className="lp-label">{es ? "Gastos" : "Expenses"}</span>
                  <span className={cn("lp-stat-value", expense === 0 && "is-muted")}>
                    <SensitiveAmount>{formatCurrency(expense)}</SensitiveAmount>
                  </span>
                </div>
                <div className="lp-stat">
                  <span className="lp-label">Balance</span>
                  <span className={cn("lp-stat-value", net > 0 ? "is-income" : net < 0 ? "is-negative" : "is-muted")}>
                    <SensitiveAmount>{net === 0 ? formatCurrency(0) : signed(net)}</SensitiveAmount>
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="lp-card lp-group">
            {importable && bank && (
              <button type="button" className="lp-row" onClick={toggleImport} aria-expanded={importOpen} data-state={importOpen ? "open" : "closed"}>
                <span className="lp-icon ad-action-icon">
                  <FileUp className="size-[18px]" />
                </span>
                <span className="lp-main">
                  <span className="lp-title">
                    <span>{es ? "Importar extracto" : "Import statement"}</span>
                  </span>
                  <span className="lp-meta">
                    {bank.name} · {bank.formatLabel}
                  </span>
                </span>
                <ChevronDown className="lp-chevron size-4" />
              </button>
            )}
            <button type="button" className="lp-row" onClick={() => setBulkOpen(true)} disabled={txLoading || transactions.length === 0}>
              <span className="lp-icon ad-action-icon">
                <ListX className="size-[18px]" />
              </span>
              <span className="lp-main">
                <span className="lp-title">
                  <span>{t("accounts.deleteTransactions")}</span>
                </span>
                <span className="lp-meta">{es ? "Todas o por meses" : "All or by month"}</span>
              </span>
            </button>
            <button type="button" className="lp-row lp-row--danger" onClick={() => setDeleteOpen(true)}>
              <span className="lp-icon">
                <Trash2 className="size-[18px]" />
              </span>
              <span className="lp-main">
                <span className="lp-title">
                  <span>{es ? "Eliminar cuenta" : "Delete account"}</span>
                </span>
              </span>
            </button>
          </div>
        </aside>

        <div className="lp-content">
          {importable && importOpen && (
            <div ref={importRef} className="lp-card ad-import lp-fade">
              <BankStatementUpload accountId={account.id} bankProvider={account.bank_provider as BankProvider} autoOpenFilePicker={autoUpload} />
            </div>
          )}

          <section className="lp-section">
            <div className="lp-section-head ad-list-head">
              <span className="lp-section-title">
                {es ? "Movimientos" : "Activity"} · {monthTxs.length}
              </span>
              <button type="button" className="lp-chip" onClick={() => setCreateOpen(true)}>
                <Plus className="size-3.5" strokeWidth={2.75} />
                {es ? "Añadir" : "Add"}
              </button>
            </div>
          </section>

          {txLoading ? (
            <div className="lp-card lp-group">
              {[0, 1, 2].map((i) => (
                <div key={i} className="lp-skeleton-row">
                  <div className="skeleton" />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div className="skeleton" style={{ height: 12, width: "55%" }} />
                    <div className="skeleton" style={{ height: 10, width: "35%" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : monthTxs.length === 0 ? (
            <div className="lp-card lp-empty lp-fade" key={`empty-${selectedKey}`}>
              <p className="lp-empty-title">{t("transactions.emptyThisMonth")}</p>
              <p className="lp-empty-text">
                {canPrev
                  ? es
                    ? "Desliza el resumen o usa las flechas para ver otros meses"
                    : "Swipe the summary or use the arrows to see other months"
                  : es
                    ? "Añade una transacción o importa un extracto"
                    : "Add a transaction or import a statement"}
              </p>
            </div>
          ) : (
            <div className="lp-fade" key={`list-${selectedKey}`}>
              <TransactionDayList transactions={monthTxs} countedIds={countedIds} hideAccount />
            </div>
          )}
        </div>
      </div>

      <AccountSheet open={editOpen} onOpenChange={setEditOpen} account={account} onDeleted={() => router.push("/accounts")} />
      <TransactionSheet open={createOpen} onOpenChange={setCreateOpen} defaultAccountId={account.id} />
      <BulkDeleteSheet open={bulkOpen} onOpenChange={setBulkOpen} accountId={account.id} transactions={transactions} />
      <ConfirmDeleteSheet
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={es ? `¿Eliminar «${account.name}»?` : `Delete “${account.name}”?`}
        description={<AccountDeleteWarning accountId={account.id} />}
        confirmLabel={es ? "Sí, eliminar" : "Yes, delete"}
        pending={deleteAccount.isPending}
        onConfirm={async () => {
          await deleteAccount.mutateAsync(account.id);
          router.push("/accounts");
        }}
      />
    </div>
  );
}
