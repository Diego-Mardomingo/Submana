"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ListX, Pencil, SquarePen, Trash2 } from "lucide-react";
import BankStatementUpload from "@/components/BankStatementUpload";
import { AccountTransactionsWarning, ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { SwipeToReveal, SwipeToRevealGroup } from "@/components/SwipeToReveal";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useAccounts, useDeleteAccount, useDeleteAccountTransactions, type Account } from "@/hooks/useAccounts";
import { useCategories, useCategoryLookup } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { saveScrollForReturn, useScrollRestore } from "@/hooks/useScrollRestore";
import { useDeleteTransaction, useTransactions, type Transaction } from "@/hooks/useTransactions";
import type { BankProvider } from "@/lib/bankProviders";
import { appNow, monthKey, parseDateString, shiftMonth } from "@/lib/date";
import { formatCurrency, monthKeyLabel, monthName } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { metricTransactions, sumByType } from "@/lib/metricsFilters";

const IMPORTABLE_PROVIDERS = ["trade_republic", "revolut", "bbva", "imagin"];

const txMonthKey = (tx: Transaction) => {
  const d = parseDateString(tx.date);
  return monthKey(d.getFullYear(), d.getMonth() + 1);
};

/** "Delete transactions" dialog: all of them or a month range. */
function BulkDeleteDialog({ open, onOpenChange, accountId, transactions }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  transactions: Transaction[];
}) {
  const t = useTranslations(useLang());
  const lang = useLang();
  const router = useRouter();
  const deleteTransactions = useDeleteAccountTransactions();
  const monthKeys = useMemo(() => [...new Set(transactions.map(txMonthKey))].sort(), [transactions]);
  const [mode, setMode] = useState<"all" | "range">("all");
  const [range, setRange] = useState({ start: monthKeys[0] ?? "", end: monthKeys.at(-1) ?? "" });
  const [error, setError] = useState(false);
  const count =
    mode === "all"
      ? transactions.length
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

  const monthSelect = (edge: "start" | "end", label: string) => (
    <div className="grid gap-2">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      <Select
        value={range[edge]}
        onValueChange={(v) =>
          setRange(edge === "start" ? { start: v, end: v > range.end ? v : range.end } : { start: v < range.start ? v : range.start, end: v })
        }
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {monthKeys.map((key) => (
            <SelectItem key={key} value={key}>
              {monthKeyLabel(key, lang, "long")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("accounts.deleteTransactionsTitle")}</DialogTitle>
          <DialogDescription>{t("accounts.deleteTransactionsConfirm").replace("{count}", String(count))}</DialogDescription>
        </DialogHeader>
        {error && (
          <p className="text-destructive text-sm" role="alert">
            {t("accounts.deleteTransactionsError")}
          </p>
        )}
        <RadioGroup className="gap-4" value={mode} onValueChange={(v) => setMode(v as "all" | "range")}>
          <div className="flex items-center gap-3">
            <RadioGroupItem value="all" id="bulk-delete-all" />
            <Label htmlFor="bulk-delete-all" className="font-normal">
              {t("accounts.deleteTransactionsAll")}
            </Label>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <RadioGroupItem value="range" id="bulk-delete-range" />
              <Label htmlFor="bulk-delete-range" className="font-normal">
                {t("accounts.deleteTransactionsRange")}
              </Label>
            </div>
            {mode === "range" && (
              <div className="grid gap-4 pl-7 sm:grid-cols-2">
                {monthSelect("start", t("accounts.deleteTransactionsStartMonth"))}
                {monthSelect("end", t("accounts.deleteTransactionsEndMonth"))}
              </div>
            )}
          </div>
        </RadioGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="destructive" disabled={count === 0 || deleteTransactions.isPending} onClick={confirm}>
            {deleteTransactions.isPending && <Spinner className="mr-2 size-4" />}
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AccountDetail({ account }: { account: Account }) {
  useScrollRestore();
  const lang = useLang();
  const t = useTranslations(lang);
  const es = lang === "es";
  const router = useRouter();
  const searchParams = useSearchParams();
  const importSectionRef = useRef<HTMLDivElement>(null);
  const shouldScrollToImport = searchParams.get("import") === "1";
  const shouldAutoOpenFilePicker = searchParams.get("autoupload") === "1";
  const [showDelete, setShowDelete] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const deleteAccount = useDeleteAccount();
  const deleteTransaction = useDeleteTransaction();

  // Every transaction is needed anyway to detect transfers between accounts.
  const { data: allTransactions = [], isLoading: txLoading } = useTransactions();
  const { data: categories } = useCategories();
  const categoryLookup = useCategoryLookup();
  const { data: accountsList } = useAccounts();

  const transactions = useMemo(
    () =>
      allTransactions
        .filter((tx) => tx.account_id === account.id)
        .sort((a, b) => parseDateString(b.date).getTime() - parseDateString(a.date).getTime()),
    [allTransactions, account.id]
  );
  const metricIds = useMemo(() => new Set(metricTransactions(allTransactions, categories).map((tx) => tx.id)), [allTransactions, categories]);
  const cached = accountsList?.find((a) => a.id === account.id);
  const displayBalance = Number(cached?.balance ?? account.balance);

  useEffect(() => {
    if ((!shouldScrollToImport && !shouldAutoOpenFilePicker) || !importSectionRef.current) return;
    if (shouldScrollToImport) importSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    const timer = window.setTimeout(() => router.replace(`/account/${account.id}`, { scroll: false }), 350);
    return () => window.clearTimeout(timer);
  }, [shouldScrollToImport, shouldAutoOpenFilePicker, router, account.id]);

  // Carousel of months, from the first transaction up to the current month.
  const now = appNow();
  const currentKey = monthKey(now.getFullYear(), now.getMonth() + 1);
  const byMonth = new Map<string, Map<string, Transaction[]>>();
  for (const tx of transactions) {
    const d = parseDateString(tx.date);
    const month = monthKey(d.getFullYear(), d.getMonth() + 1);
    const day = `${month}-${String(d.getDate()).padStart(2, "0")}`;
    if (!byMonth.has(month)) byMonth.set(month, new Map());
    const days = byMonth.get(month)!;
    days.set(day, [...(days.get(day) ?? []), tx]);
  }
  const firstKey = [...byMonth.keys()].sort()[0] ?? currentKey;
  const months: string[] = [];
  for (let [y, m] = firstKey.split("-").map(Number); monthKey(y, m) <= currentKey; ({ year: y, month: m } = shiftMonth(y, m, 1))) {
    months.push(monthKey(y, m));
  }
  const currentIndex = months.length - 1;

  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(currentIndex);
  useEffect(() => {
    if (!carouselApi) return;
    const update = () => setSelectedIndex(carouselApi.selectedScrollSnap());
    carouselApi.on("select", update).on("scroll", update);
    return () => {
      carouselApi.off("select", update).off("scroll", update);
    };
  }, [carouselApi]);
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || !carouselApi) return;
    if (e.key === "ArrowLeft" && carouselApi.canScrollPrev()) carouselApi.scrollPrev();
    else if (e.key === "ArrowRight" && carouselApi.canScrollNext()) carouselApi.scrollNext();
    else return;
    e.preventDefault();
  });
  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const accentColor = account.color || "var(--accent)";
  const returnPath = `/account/${account.id}`;
  const emoji = (id?: string | null) => (id ? categoryLookup.emoji.get(id) : undefined);
  const txLabel = (tx: Transaction) => tx.description || t(tx.type === "income" ? "transactions.income" : "transactions.expense");

  return (
    <>
      <div className="account-detail" style={{ "--account-accent": accentColor } as React.CSSProperties}>
        <div className="account-detail-header">
          <div className="account-detail-icon-wrapper">
            <div className="account-detail-icon">
              {account.icon ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote logos from arbitrary hosts
                <img src={account.icon} alt={account.name} />
              ) : (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="1.5">
                  <rect x="1" y="4" width="22" height="16" rx="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
              )}
            </div>
            {account.name.toLowerCase().includes("remunerada") && (
              <div className="account-badge-interest account-badge-interest-lg" title={es ? "Cuenta remunerada" : "Savings account"}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              </div>
            )}
          </div>
          <h1 className="account-detail-name">{account.name}</h1>
          <div className="account-detail-balance">
            <SensitiveAmount>{formatCurrency(displayBalance)}</SensitiveAmount>
          </div>
          {account.is_default && (
            <span className="account-badge-default">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {es ? "Principal" : "Default"}
            </span>
          )}
        </div>

        <div className="account-stats-carousel">
          <div className="account-stats-month-header">
            <button
              type="button"
              className="account-stats-month-title"
              onClick={() => carouselApi?.scrollTo(currentIndex)}
              title={es ? "Ir al mes actual" : "Go to current month"}
            >
              {months[selectedIndex] && monthKeyLabel(months[selectedIndex], lang, "long")}
              {selectedIndex !== currentIndex && (
                <svg className="account-stats-home-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              )}
            </button>
          </div>
          <Carousel
            opts={{ align: "center", loop: false, duration: 25, startIndex: currentIndex }}
            setApi={setCarouselApi}
            className="account-stats-carousel-inner"
          >
            <CarouselContent>
              {months.map((key) => {
                const monthTxs = [...(byMonth.get(key)?.values() ?? [])].flat();
                const forMetrics = monthTxs.filter((tx) => metricIds.has(tx.id));
                const { income, expense } = sumByType(forMetrics);
                const balance = income - expense;
                const incomeCount = forMetrics.filter((tx) => tx.type === "income").length;
                return (
                  <CarouselItem key={key}>
                    <div className="account-detail-stats">
                      <div className={`account-stat-card balance ${balance > 0 ? "positive" : balance < 0 ? "negative" : "neutral"}`}>
                        <span className="account-stat-label">{es ? "Balance del Mes" : "Month Balance"}</span>
                        <span className="account-stat-value account-stat-value-balance">
                          {balance >= 0 ? "+" : ""}
                          <SensitiveAmount>{formatCurrency(balance)}</SensitiveAmount>
                        </span>
                      </div>
                      <div className="account-stat-card account-stat-transactions">
                        <span className="account-stat-label">{es ? "Transacciones" : "Transactions"}</span>
                        <div className="account-stat-row">
                          <span className="account-stat-value">{monthTxs.length}</span>
                          <span className="account-stat-separator">|</span>
                          <span className="account-stat-inline income">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="17 11 12 6 7 11" />
                            </svg>
                            {incomeCount}
                          </span>
                          <span className="account-stat-inline expense">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="7 13 12 18 17 13" />
                            </svg>
                            {forMetrics.length - incomeCount}
                          </span>
                        </div>
                      </div>
                      <div className="account-stat-card income">
                        <span className="account-stat-label">{es ? "Ingresos" : "Income"}</span>
                        <span className="account-stat-value">
                          <SensitiveAmount>{formatCurrency(income)}</SensitiveAmount>
                        </span>
                      </div>
                      <div className="account-stat-card expense">
                        <span className="account-stat-label">{es ? "Gastos" : "Expenses"}</span>
                        <span className="account-stat-value">
                          <SensitiveAmount>{formatCurrency(expense)}</SensitiveAmount>
                        </span>
                      </div>
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious className="account-stats-carousel-nav account-stats-carousel-prev" />
            <CarouselNext className="account-stats-carousel-nav account-stats-carousel-next" />
          </Carousel>
        </div>

        <div className="account-detail-actions">
          <Link href={`/account/${account.id}/edit`} className="btn-edit">
            <SquarePen className="size-[18px]" />
            {t("common.edit")}
          </Link>
          <Button
            type="button"
            variant="outline"
            className="btn-clear-tx"
            disabled={txLoading || transactions.length === 0}
            onClick={() => setShowBulkDelete(true)}
          >
            <ListX className="size-[18px]" aria-hidden />
            {t("accounts.deleteTransactions")}
          </Button>
          <Button variant="destructive" onClick={() => setShowDelete(true)} className="btn-delete">
            <Trash2 className="size-[18px]" />
            {t("common.delete")}
          </Button>
        </div>

        {account.bank_provider && IMPORTABLE_PROVIDERS.includes(account.bank_provider) && (
          <div ref={importSectionRef}>
            <BankStatementUpload
              accountId={account.id}
              bankProvider={account.bank_provider as BankProvider}
              autoOpenFilePicker={shouldAutoOpenFilePicker}
            />
          </div>
        )}

        <div className="account-transactions-section">
          <h2 className="account-transactions-title">{es ? "Transacciones" : "Transactions"}</h2>

          {txLoading ? (
            <div className="account-transactions-list">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="account-tx-skeleton h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="account-transactions-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <p>{es ? "No hay transacciones" : "No transactions"}</p>
            </div>
          ) : (
            <div className="account-transactions-grouped">
              {[...byMonth].map(([month, days]) => (
                <div key={month} className="account-tx-month-group">
                  <h3 className="account-tx-month-header">
                    {monthKeyLabel(month, lang, "long")}
                  </h3>
                  <div className="account-tx-days">
                    {[...days].map(([day, txs]) => (
                      <div key={day} className="account-tx-day-group">
                        <div className="account-tx-day-header">
                          {parseDateString(day).getDate()} {monthName(Number(month.slice(5)), lang)}
                        </div>
                        <SwipeToRevealGroup className="account-tx-day-items">
                          {txs.map((tx) => (
                            <SwipeToReveal
                              key={tx.id}
                              id={tx.id}
                              className="account-tx-swipe-wrapper"
                              swipeHint
                              desktopMinWidth={1024}
                              actions={
                                <div className="account-tx-actions-reveal flex items-center gap-2">
                                  <Link
                                    href={`/transactions/edit/${tx.id}?returnTo=${encodeURIComponent(returnPath)}`}
                                    className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)]"
                                    aria-label={t("common.edit")}
                                    onClick={() => saveScrollForReturn(returnPath)}
                                  >
                                    <Pencil className="size-5" />
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setTxToDelete(tx);
                                    }}
                                    className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)]"
                                    aria-label={t("common.delete")}
                                  >
                                    <Trash2 className="size-5" />
                                  </button>
                                </div>
                              }
                            >
                              <div className={`account-transaction-item ${tx.type}`}>
                                <span className="account-transaction-desc">{txLabel(tx)}</span>
                                <div className="account-transaction-footer">
                                  <span className="account-transaction-category">
                                    {tx.category && (
                                      <>
                                        {emoji(tx.category_id) && <span className="tx-card-category-emoji">{emoji(tx.category_id)}</span>}
                                        {tx.category.name}
                                      </>
                                    )}
                                    {tx.category && tx.subcategory && " › "}
                                    {tx.subcategory && (
                                      <>
                                        {(() => {
                                          const e = emoji(tx.subcategory_id) ?? emoji(categoryLookup.parent.get(tx.subcategory_id ?? ""));
                                          return e && <span className="tx-card-category-emoji">{e}</span>;
                                        })()}
                                        {tx.subcategory.name}
                                      </>
                                    )}
                                  </span>
                                  <span className={`account-transaction-amount ${tx.type}`}>
                                    {tx.type === "income" ? "+" : "-"}
                                    <SensitiveAmount>{formatCurrency(Number(tx.amount))}</SensitiveAmount>
                                  </span>
                                </div>
                              </div>
                            </SwipeToReveal>
                          ))}
                        </SwipeToRevealGroup>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDeleteDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title={t("accounts.delete")}
        description={t("accounts.deleteConfirm")}
        pending={deleteAccount.isPending}
        onConfirm={async () => {
          await deleteAccount.mutateAsync(account.id);
          router.push("/accounts");
        }}
      >
        <AccountTransactionsWarning count={transactions.length} />
      </ConfirmDeleteDialog>

      <ConfirmDeleteDialog
        open={!!txToDelete}
        onOpenChange={(open) => !open && setTxToDelete(null)}
        title={t("transactions.delete")}
        description={
          txToDelete && (
            <span>
              {txLabel(txToDelete)} - <SensitiveAmount>{formatCurrency(Number(txToDelete.amount))}</SensitiveAmount>
            </span>
          )
        }
        pending={deleteTransaction.isPending}
        onConfirm={() => {
          if (txToDelete) deleteTransaction.mutate(txToDelete.id);
          setTxToDelete(null);
        }}
      />

      {showBulkDelete && (
        <BulkDeleteDialog open onOpenChange={setShowBulkDelete} accountId={account.id} transactions={transactions} />
      )}
    </>
  );
}

