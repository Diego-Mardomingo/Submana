"use client";

import { useState, useEffect, useRef, useMemo, memo } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useTransactions } from "@/hooks/useTransactions";
import { useDeleteTransaction } from "@/hooks/useDeleteTransaction";
import { useCategories } from "@/hooks/useCategories";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { parseDateString } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, House, Trash2, Euro, Loader2 } from "lucide-react";
import { SwipeToReveal, SwipeToRevealGroup } from "@/components/SwipeToReveal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type TransactionItem = {
  id: string;
  date: string;
  amount: number;
  type: string;
  description?: string;
  account?: { name: string; color?: string };
  category_id?: string | null;
  subcategory_id?: string | null;
  category?: { name: string };
  subcategory?: { name: string };
};

const formatCurrency = (n: number) => {
  const formatted = new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(n);
  return `${formatted} €`;
};

function TransactionsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2" />
      <path d="M15 7.8c-.523 -.502 -1.172 -.8 -1.875 -.8c-1.727 0 -3.125 1.791 -3.125 4s1.398 4 3.125 4c.703 0 1.352 -.298 1.874 -.8" />
      <path d="M9 11h4" />
    </svg>
  );
}

type TransactionCardProps = {
  tx: TransactionItem;
  categoryEmoji: string | null;
  subcategoryEmoji: string | null;
  incomeLabel: string;
  expenseLabel: string;
};

const TransactionCard = memo(function TransactionCard({
  tx,
  categoryEmoji,
  subcategoryEmoji,
  incomeLabel,
  expenseLabel,
}: TransactionCardProps) {
  return (
    <Link
      href={`/transactions/edit/${tx.id}`}
      className={`tx-card tx-card-${tx.type}`}
      style={{ viewTransitionName: `tx-card-${tx.id}` }}
    >
      <div className="tx-card-icon">
        {tx.type === "income" ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
            <polyline points="17 18 23 18 23 12" />
          </svg>
        )}
      </div>
      <div className="tx-card-content">
        <span className="tx-card-desc">
          {tx.description || tx.category?.name || (tx.type === "income" ? incomeLabel : expenseLabel)}
        </span>
        <div className="tx-card-meta">
          {tx.account && (
            <span className="tx-card-account-indicator">
              <span
                className="tx-card-account-dot"
                style={{ backgroundColor: tx.account.color || "var(--gris-claro)" }}
              />
              <span className="tx-card-account-name">{tx.account.name}</span>
            </span>
          )}
          {tx.account && (tx.category || tx.subcategory) && (
            <span className="tx-card-meta-separator" aria-hidden>|</span>
          )}
          {(tx.category || tx.subcategory) && (
            <div className="tx-card-categories">
              {tx.category && (
                <span className="tx-card-category-indicator">
                  {categoryEmoji && <span className="tx-card-category-emoji">{categoryEmoji}</span>}
                  <span>{tx.category.name}</span>
                </span>
              )}
              {tx.subcategory && (
                <span className="tx-card-category-indicator">
                  {subcategoryEmoji && <span className="tx-card-category-emoji">{subcategoryEmoji}</span>}
                  <span>{tx.subcategory.name}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className={`tx-card-amount tx-card-amount-${tx.type}`}>
        {tx.type === "income" ? "+" : "-"}
        {formatCurrency(Number(tx.amount))}
      </div>
      <svg className="tx-card-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
});

export default function TransactionsBody() {
  const lang = useLang();
  const t = useTranslations(lang);
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const { data: transactions = [], isLoading, isFetching } = useTransactions(year, month + 1);
  const { data: categoriesData } = useCategories();
  const deleteTx = useDeleteTransaction();

  const subToParent = useMemo(() => {
    const m = new Map<string, string>();
    const walk = (list: Array<{ id: string; subcategories?: Array<{ id: string }> }>) => {
      for (const p of list) {
        for (const s of p.subcategories ?? []) m.set(s.id, p.id);
      }
    };
    walk(categoriesData?.defaultCategories ?? []);
    walk(categoriesData?.userCategories ?? []);
    return m;
  }, [categoriesData]);

  const categoryIdToEmoji = useMemo(() => {
    const m = new Map<string, string>();
    const walk = (list: Array<{ id: string; emoji?: string | null; subcategories?: Array<{ id: string; emoji?: string | null }> }>) => {
      for (const p of list) {
        if (p.emoji) m.set(p.id, p.emoji);
        for (const s of p.subcategories ?? []) {
          if (s.emoji) m.set(s.id, s.emoji);
        }
      }
    };
    walk(categoriesData?.defaultCategories ?? []);
    walk(categoriesData?.userCategories ?? []);
    return m;
  }, [categoriesData]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<TransactionItem | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const swipeAreaRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const changeMonthRef = useRef<(delta: number) => void>(() => {});
  const SWIPE_THRESHOLD = 50;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const set = () => setIsMobile(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  // Registrar swipe solo cuando el área existe en el DOM (tras dejar de cargar) y estamos en móvil
  useEffect(() => {
    if (!isMobile || isLoading || !swipeAreaRef.current) return;
    const el = swipeAreaRef.current;
    const onStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    };
    const onEnd = (e: TouchEvent) => {
      const start = touchStartX.current;
      touchStartX.current = null;
      if (start === null || !e.changedTouches[0]) return;
      const delta = e.changedTouches[0].clientX - start;
      if (Math.abs(delta) >= SWIPE_THRESHOLD) {
        changeMonthRef.current(delta > 0 ? -1 : 1);
      }
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [isMobile, isLoading]);

  const formatDate = (dateStr: string) => {
    const d = parseDateString(dateStr);
    return d.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const months = lang === "es"
    ? ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const changeMonth = (delta: number) => {
    const go = () => {
      let newMonth = month + delta;
      let newYear = year;
      if (newMonth < 0) {
        newMonth = 11;
        newYear--;
      } else if (newMonth > 11) {
        newMonth = 0;
        newYear++;
      }
      setMonth(newMonth);
      setYear(newYear);
    };
    if (typeof document !== "undefined" && (document as Document & { startViewTransition?: (cb: () => void) => void }).startViewTransition) {
      (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(() => flushSync(go));
    } else {
      go();
    }
  };

  const handleToday = () => {
    const go = () => {
      const today = new Date();
      setYear(today.getFullYear());
      setMonth(today.getMonth());
    };
    if (typeof document !== "undefined" && (document as Document & { startViewTransition?: (cb: () => void) => void }).startViewTransition) {
      (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(() => flushSync(go));
    } else {
      go();
    }
  };

  changeMonthRef.current = changeMonth;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") changeMonth(-1);
      else if (e.key === "ArrowRight") changeMonth(1);
      else if (e.key === "ArrowDown") handleToday();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [month, year]);

  const prefetchMonth = (delta: number) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 0) { newMonth = 11; newYear--; } else if (newMonth > 11) { newMonth = 0; newYear++; }
    queryClient.prefetchQuery({ queryKey: queryKeys.transactions.list({ year: newYear, month: newMonth + 1 }) });
  };

  const txList = transactions as TransactionItem[];
  const totalIncome = txList.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + Number(tx.amount), 0);
  const totalExpense = txList.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + Number(tx.amount), 0);
  const totalBalance = totalIncome - totalExpense;

  const grouped = txList.reduce(
    (acc, tx) => {
      const date = tx.date.split("T")[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(tx);
      return acc;
    },
    {} as Record<string, TransactionItem[]>
  );
  const sortedDates = Object.keys(grouped).sort((a, b) => parseDateString(b).getTime() - parseDateString(a).getTime());

  const hasTransactions = txList.length > 0;

  if (isLoading) {
    return (
      <div className="page-container">
        <header className="page-header-clean">
          <div className="page-header-left">
            <div className="page-header-icon">
              <TransactionsIcon className="size-[26px]" />
            </div>
            <div className="page-header-text">
              <h1>{t("transactions.title")}</h1>
              <p>{t("transactions.heroSubtitle")}</p>
            </div>
          </div>
        </header>
        <div className="skeleton" style={{ height: 56, borderRadius: 12, marginBottom: 16 }} />
        <div className="tx-stats-panel">
          <div className="info-stats-row">
            <div className="skeleton" style={{ height: 90, borderRadius: 18 }} />
            <div className="skeleton" style={{ height: 90, borderRadius: 18 }} />
          </div>
          <div className="skeleton" style={{ height: 90, borderRadius: 18 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
          <div className="skeleton" style={{ height: 72, borderRadius: 14 }} />
          <div className="skeleton" style={{ height: 72, borderRadius: 14 }} />
          <div className="skeleton" style={{ height: 72, borderRadius: 14 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container fade-in">
      <header className="page-header-clean">
        <div className="page-header-left">
          <div className="page-header-icon">
            <TransactionsIcon className="size-[26px]" />
          </div>
          <div className="page-header-text">
            <h1>{t("transactions.title")}</h1>
            <p>{t("transactions.heroSubtitle")}</p>
          </div>
        </div>
        <Link href="/transactions/new" className="add-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>{t("transactions.add")}</span>
        </Link>
      </header>

      {/* Month Selector + Stats: swipe zone solo en móvil (solo esta zona responde al swipe) */}
      <div className="tx-swipe-zone">
      <div ref={swipeAreaRef} className="tx-month-swipe-area">
        <div className="tx-month-selector">
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={() => changeMonth(-1)}
            onMouseEnter={() => prefetchMonth(-1)}
            aria-label="Previous"
            className="tx-month-arrow tx-month-arrow-left rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-6" strokeWidth={1.5} />
          </Button>
          <button
            type="button"
            className="tx-month-display"
            onClick={handleToday}
            onKeyDown={(e) => e.key === "Enter" && handleToday()}
          >
            <span className="tx-month-name">{months[month]}</span>
            <span className="tx-month-year">{year}</span>
            {isFetching ? (
              <Loader2 className="tx-month-loading size-5 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <House className="tx-month-home" strokeWidth={1.5} aria-hidden />
            )}
          </button>
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={() => changeMonth(1)}
            onMouseEnter={() => prefetchMonth(1)}
            aria-label="Next"
            className="tx-month-arrow tx-month-arrow-right rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-6" strokeWidth={1.5} />
          </Button>
        </div>

        {/* Indicador de carga cuando los datos pueden ser del mes anterior */}
        {isFetching && !isLoading && (
          <div className="tx-month-loading-bar" role="status" aria-label={lang === "es" ? "Cargando datos del mes" : "Loading month data"}>
            <Loader2 className="size-4 animate-spin" />
            <span>{lang === "es" ? "Cargando..." : "Loading..."}</span>
          </div>
        )}

        {/* Stats Cards */}
      {hasTransactions && (
        <div className="tx-stats-panel tx-month-content" key={`stats-${year}-${month}`}>
          <div className="info-stats-row">
            <div className="info-stat-card info-stat-income">
              <div className="info-stat-icon info-stat-icon-income">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              </div>
              <div className="info-stat-content">
                <span className="info-stat-label">{t("transactions.monthlyIncome")}</span>
                <span className="info-stat-value info-stat-value-income">{formatCurrency(totalIncome)}</span>
              </div>
            </div>
            <div className="info-stat-card info-stat-expense">
              <div className="info-stat-icon info-stat-icon-expense">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                  <polyline points="17 18 23 18 23 12" />
                </svg>
              </div>
              <div className="info-stat-content">
                <span className="info-stat-label">{t("transactions.monthlyExpense")}</span>
                <span className="info-stat-value info-stat-value-expense">{formatCurrency(totalExpense)}</span>
              </div>
            </div>
          </div>
          <div className={`info-stat-card info-stat-balance info-stat-balance-full info-stat-balance-${totalBalance > 0 ? "positive" : totalBalance < 0 ? "negative" : "neutral"}`}>
            <div className="info-stat-icon info-stat-icon-balance">
              <Euro className="size-6" strokeWidth={2} />
            </div>
            <div className="info-stat-content">
              <span className="info-stat-label">{t("transactions.monthlyBalance")}</span>
              <span className="info-stat-value info-stat-value-balance">{totalBalance >= 0 ? "+" : ""}{formatCurrency(totalBalance)}</span>
            </div>
          </div>
        </div>
      )}

      {!hasTransactions ? (
        <div className="tx-empty-month tx-month-content" key={`empty-${year}-${month}`}>
          <div className="tx-empty-month-icon">
            <TransactionsIcon className="size-10" />
          </div>
          <p className="tx-empty-month-text">{t("transactions.emptyThisMonth")}</p>
        </div>
      ) : null}
      </div>

      {hasTransactions ? (
        <div className="tx-sections tx-month-content" key={`list-${year}-${month}`}>
          {sortedDates.map((date) => (
            <section className="subs-section" key={date}>
              <div className="subs-section-header">
                <span className="subs-section-title">{formatDate(date)}</span>
                <span className="subs-section-count">{grouped[date].length}</span>
              </div>
              <SwipeToRevealGroup className="tx-list">
                {grouped[date].map((tx) => (
                  <SwipeToReveal
                    key={tx.id}
                    id={tx.id}
                    className="tx-swipe-wrapper"
                    swipeHint
                    desktopMinWidth={1024}
                    actions={
                      <div className="tx-card-actions-reveal flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setTxToDelete(tx);
                            setDeleteModalOpen(true);
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
                      categoryEmoji={tx.category_id ? categoryIdToEmoji.get(tx.category_id) ?? null : null}
                      subcategoryEmoji={
                        tx.subcategory_id
                          ? (categoryIdToEmoji.get(tx.subcategory_id) ?? categoryIdToEmoji.get(subToParent.get(tx.subcategory_id) ?? "") ?? null)
                          : null
                      }
                      incomeLabel={t("transactions.income")}
                      expenseLabel={t("transactions.expense")}
                    />
                  </SwipeToReveal>
                ))}
              </SwipeToRevealGroup>
            </section>
          ))}
        </div>
      ) : null}
      </div>

      <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--danger-soft)] mx-auto mb-2">
              <Trash2 className="size-7 text-[var(--danger)]" />
            </div>
            <AlertDialogTitle className="text-center">
              {lang === "es" ? "Eliminar transacción" : "Delete transaction"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {t("transactions.deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-3">
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (!txToDelete) return;
                await deleteTx.mutateAsync(txToDelete.id);
                setDeleteModalOpen(false);
                setTxToDelete(null);
              }}
              disabled={deleteTx.isPending}
            >
              {deleteTx.isPending ? (
                <span className="animate-pulse">{t("common.delete")}</span>
              ) : (
                t("common.delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
