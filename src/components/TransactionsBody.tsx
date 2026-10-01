"use client";

import { memo, useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Euro, House, Loader2, Pencil, Trash2 } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { TransactionsIcon } from "@/components/icons";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { SwipeToReveal, SwipeToRevealGroup } from "@/components/SwipeToReveal";
import { AddButton } from "@/components/ui/add-button";
import { Button } from "@/components/ui/button";
import { useCategories, useCategoryLookup } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { saveScrollForReturn, useScrollRestore } from "@/hooks/useScrollRestore";
import { useSwipe } from "@/hooks/useSwipe";
import { prefetchMonth, useDeleteTransaction, useTransactions, type Transaction } from "@/hooks/useTransactions";
import { calendarDayInAppTimeZone, parseDateString, shiftMonth } from "@/lib/date";
import { formatCurrency, localeOf, monthName } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { metricTransactions, sumByType } from "@/lib/metricsFilters";

const TrendIcon = ({ income, size }: { income: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={size ? 2.5 : 2}>
    <polyline points={income ? "23 6 13.5 15.5 8.5 10.5 1 18" : "23 18 13.5 8.5 8.5 13.5 1 6"} />
    <polyline points={income ? "17 6 23 6 23 12" : "17 18 23 18 23 12"} />
  </svg>
);

const TransactionCard = memo(function TransactionCard(props: {
  tx: Transaction;
  categoryEmoji?: string;
  subcategoryEmoji?: string;
  fallbackLabel: string;
  editHref: string;
  onBeforeEdit: () => void;
}) {
  const { tx, categoryEmoji, subcategoryEmoji, fallbackLabel, editHref, onBeforeEdit } = props;
  const categoryChips = [
    [tx.category, categoryEmoji],
    [tx.subcategory, subcategoryEmoji],
  ] as const;
  return (
    <Link href={editHref} className={`tx-card tx-card-${tx.type}`} style={{ viewTransitionName: `tx-card-${tx.id}` }} onClick={onBeforeEdit}>
      <div className="tx-card-icon">
        <TrendIcon income={tx.type === "income"} size={20} />
      </div>
      <div className="tx-card-content">
        <span className="tx-card-desc">{tx.description || tx.category?.name || fallbackLabel}</span>
        <div className="tx-card-meta">
          {tx.account && (
            <span className="tx-card-account-indicator">
              <span className="tx-card-account-dot" style={{ backgroundColor: tx.account.color || "var(--gris-claro)" }} />
              <span className="tx-card-account-name">{tx.account.name}</span>
            </span>
          )}
          {tx.account && (tx.category || tx.subcategory) && (
            <span className="tx-card-meta-separator" aria-hidden>
              |
            </span>
          )}
          {(tx.category || tx.subcategory) && (
            <div className="tx-card-categories">
              {categoryChips.map(
                ([cat, emoji], i) =>
                  cat && (
                    <span key={i} className="tx-card-category-indicator">
                      {emoji && <span className="tx-card-category-emoji">{emoji}</span>}
                      <span>{cat.name}</span>
                    </span>
                  )
              )}
            </div>
          )}
        </div>
      </div>
      <div className={`tx-card-amount tx-card-amount-${tx.type}`}>
        {tx.type === "income" ? "+" : "-"}
        <SensitiveAmount>{formatCurrency(Number(tx.amount))}</SensitiveAmount>
      </div>
      <svg className="tx-card-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
});

const MonthSkeleton = ({ className }: { className?: string }) => (
  <>
    <div className={`tx-stats-panel ${className ?? ""}`}>
      <div className="info-stats-row">
        <div className="skeleton" style={{ height: 90, borderRadius: 18 }} />
        <div className="skeleton" style={{ height: 90, borderRadius: 18 }} />
      </div>
      <div className="skeleton" style={{ height: 90, borderRadius: 18 }} />
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton" style={{ height: 72, borderRadius: 14 }} />
      ))}
    </div>
  </>
);

/** Reads ?year=&month= (1-12), falling back to the current month. */
function useUrlMonth() {
  const params = useSearchParams();
  const year = parseInt(params.get("year") ?? "", 10);
  const month = parseInt(params.get("month") ?? "", 10);
  const now = new Date();
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12
    ? { year, month }
    : { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default function TransactionsBody() {
  const lang = useLang();
  const t = useTranslations(lang);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { year, month } = useUrlMonth();
  const { data: transactions = [], isLoading, isFetching, isPlaceholderData } = useTransactions(year, month);
  const monthDataReady = !isLoading && !isPlaceholderData;
  useScrollRestore({ ready: monthDataReady });
  const { data: categories } = useCategories();
  const categoryLookup = useCategoryLookup();
  const deleteTx = useDeleteTransaction();
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [swipeArea, setSwipeArea] = useState<HTMLDivElement | null>(null);

  const goTo = (target: { year: number; month: number }) =>
    router.replace(`/transactions?year=${target.year}&month=${target.month}`, { scroll: false });
  const changeMonth = (delta: number) => goTo(shiftMonth(year, month, delta));
  const goToToday = () => goTo({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const prefetch = (delta: number) => {
    const target = shiftMonth(year, month, delta);
    prefetchMonth(queryClient, target.year, target.month);
  };

  useSwipe(swipeArea, { onSwipeLeft: () => changeMonth(1), onSwipeRight: () => changeMonth(-1) }, 50);
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowLeft") changeMonth(-1);
    else if (e.key === "ArrowRight") changeMonth(1);
    else if (e.key === "ArrowDown") goToToday();
  });
  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const { income, expense } = sumByType(metricTransactions(transactions, categories));
  const balance = income - expense;
  const byDay = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const day = calendarDayInAppTimeZone(tx.date);
    byDay.set(day, [...(byDay.get(day) ?? []), tx]);
  }
  const days = [...byDay.keys()].sort().reverse();
  const returnPath = `/transactions?year=${year}&month=${month}`;
  const editHref = (id: string) => `/transactions/edit/${id}?returnTo=${encodeURIComponent(returnPath)}`;
  const beforeEdit = () => saveScrollForReturn(returnPath);
  const emoji = (id?: string | null) => (id ? categoryLookup.emoji.get(id) : undefined);

  const header = (
    <header className="page-header-clean">
      <div className="page-header-left">
        <div className="page-header-icon">
          <TransactionsIcon size={26} strokeWidth={2.5} />
        </div>
        <div className="page-header-text">
          <h1>{t("transactions.title")}</h1>
          <p>{t("transactions.heroSubtitle")}</p>
        </div>
      </div>
      {!isLoading && <AddButton href="/transactions/new">{t("transactions.add")}</AddButton>}
    </header>
  );

  if (isLoading) {
    return (
      <div className="page-container">
        {header}
        <div className="skeleton" style={{ height: 56, borderRadius: 12, marginBottom: 16 }} />
        <MonthSkeleton />
      </div>
    );
  }

  const arrowClass = "tx-month-arrow rounded-full text-muted-foreground hover:bg-muted hover:text-foreground";
  return (
    <div className="page-container fade-in">
      {header}

      <div className="tx-swipe-zone">
        <div ref={setSwipeArea} className="tx-month-swipe-area">
          <div className="tx-month-selector">
            <Button
              variant="ghost"
              size="icon-lg"
              onClick={() => changeMonth(-1)}
              onMouseEnter={() => prefetch(-1)}
              aria-label="Previous"
              className={`${arrowClass} tx-month-arrow-left`}
            >
              <ChevronLeft className="size-6" strokeWidth={1.5} />
            </Button>
            <button type="button" className="tx-month-display" onClick={goToToday}>
              <span className="tx-month-name">{monthName(month, lang, "long")}</span>
              <span className="tx-month-year">{year}</span>
              {isFetching || isPlaceholderData ? (
                <Loader2 className="tx-month-loading size-5 animate-spin text-muted-foreground" aria-hidden />
              ) : (
                <House className="tx-month-home" strokeWidth={1.5} aria-hidden />
              )}
            </button>
            <Button
              variant="ghost"
              size="icon-lg"
              onClick={() => changeMonth(1)}
              onMouseEnter={() => prefetch(1)}
              aria-label="Next"
              className={`${arrowClass} tx-month-arrow-right`}
            >
              <ChevronRight className="size-6" strokeWidth={1.5} />
            </Button>
          </div>

          {(isFetching || isPlaceholderData) && (
            <div className="tx-month-loading-bar" role="status" aria-label={lang === "es" ? "Cargando datos del mes" : "Loading month data"}>
              <Loader2 className="size-4 animate-spin" />
              <span>{lang === "es" ? "Cargando..." : "Loading..."}</span>
            </div>
          )}

          {/* The list still shows the previous month (keepPreviousData) */}
          {isPlaceholderData && <MonthSkeleton className="tx-month-content" />}

          {monthDataReady && transactions.length > 0 && (
            <div className="tx-stats-panel tx-month-content" key={`stats-${year}-${month}`}>
              <div className="info-stats-row">
                {([["income", income, "transactions.monthlyIncome"], ["expense", expense, "transactions.monthlyExpense"]] as const).map(
                  ([type, value, label]) => (
                    <div key={type} className={`info-stat-card info-stat-${type}`}>
                      <div className={`info-stat-icon info-stat-icon-${type}`}>
                        <TrendIcon income={type === "income"} />
                      </div>
                      <div className="info-stat-content">
                        <span className="info-stat-label">{t(label)}</span>
                        <span className={`info-stat-value info-stat-value-${type}`}>
                          <SensitiveAmount>{formatCurrency(value)}</SensitiveAmount>
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
              <div
                className={`info-stat-card info-stat-balance info-stat-balance-full info-stat-balance-${
                  balance > 0 ? "positive" : balance < 0 ? "negative" : "neutral"
                }`}
              >
                <div className="info-stat-icon info-stat-icon-balance">
                  <Euro className="size-6" strokeWidth={2} />
                </div>
                <div className="info-stat-content">
                  <span className="info-stat-label">{t("transactions.monthlyBalance")}</span>
                  <span className="info-stat-value info-stat-value-balance">
                    {balance >= 0 ? "+" : ""}
                    <SensitiveAmount>{formatCurrency(balance)}</SensitiveAmount>
                  </span>
                </div>
              </div>
            </div>
          )}

          {monthDataReady && transactions.length === 0 && (
            <div className="tx-empty-month tx-month-content" key={`empty-${year}-${month}`}>
              <div className="tx-empty-month-icon">
                <TransactionsIcon size={40} strokeWidth={2.5} />
              </div>
              <p className="tx-empty-month-text">{t("transactions.emptyThisMonth")}</p>
            </div>
          )}
        </div>

        {monthDataReady && transactions.length > 0 && (
          <div className="tx-sections tx-month-content" key={`list-${year}-${month}`}>
            {days.map((day) => (
              <section className="subs-section" key={day}>
                <div className="subs-section-header">
                  <span className="subs-section-title">
                    {parseDateString(day).toLocaleDateString(localeOf(lang), { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                  <span className="subs-section-count">{byDay.get(day)!.length}</span>
                </div>
                <SwipeToRevealGroup className="tx-list">
                  {byDay.get(day)!.map((tx) => (
                    <SwipeToReveal
                      key={tx.id}
                      id={tx.id}
                      className="tx-swipe-wrapper"
                      swipeHint
                      desktopMinWidth={1024}
                      actions={
                        <div className="tx-card-actions-reveal flex items-center gap-2">
                          <Link
                            href={editHref(tx.id)}
                            className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)]"
                            aria-label={t("common.edit")}
                            onClick={beforeEdit}
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
                      <TransactionCard
                        tx={tx}
                        categoryEmoji={emoji(tx.category_id)}
                        subcategoryEmoji={emoji(tx.subcategory_id) ?? emoji(categoryLookup.parent.get(tx.subcategory_id ?? ""))}
                        fallbackLabel={t(tx.type === "income" ? "transactions.income" : "transactions.expense")}
                        editHref={editHref(tx.id)}
                        onBeforeEdit={beforeEdit}
                      />
                    </SwipeToReveal>
                  ))}
                </SwipeToRevealGroup>
              </section>
            ))}
          </div>
        )}
      </div>

      <ConfirmDeleteDialog
        open={!!txToDelete}
        onOpenChange={(open) => !open && setTxToDelete(null)}
        title={lang === "es" ? "Eliminar transacción" : "Delete transaction"}
        description={t("transactions.deleteConfirm")}
        pending={deleteTx.isPending}
        onConfirm={async () => {
          if (!txToDelete) return;
          await deleteTx.mutateAsync(txToDelete.id);
          setTxToDelete(null);
        }}
      />
    </div>
  );
}
