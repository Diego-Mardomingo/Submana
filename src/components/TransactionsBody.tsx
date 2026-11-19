"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { Bones } from "@/components/Bones";
import { MonthPicker } from "@/components/MonthPicker";
import { TransactionsIcon } from "@/components/icons";
import { CompactPageHeader } from "@/components/PageHeader";
import { Money } from "@/components/Money";
import { TransactionDayList } from "@/components/TransactionDayList";
import { TransactionSheet } from "@/components/TransactionSheet";
import { useJointAccountIds } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useCreateDialog } from "@/hooks/useCreateDialog";
import { useLang } from "@/hooks/useLang";
import { useSwipe } from "@/hooks/useSwipe";
import { prefetchMonth, useTransactions } from "@/hooks/useTransactions";
import { appNow, shiftMonth } from "@/lib/date";
import { monthName } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { metricTransactions, sumByType } from "@/lib/metricsFilters";

const SkeletonRows = ({ count }: { count: number }) => (
  <div className="lp-card lp-group">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="lp-skeleton-row">
        <div className="skeleton" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="skeleton" style={{ height: 12, width: "55%" }} />
          <div className="skeleton" style={{ height: 10, width: "35%" }} />
        </div>
        <div className="skeleton" style={{ height: 12, width: 56 }} />
      </div>
    ))}
  </div>
);

const ListSkeleton = () => (
  <div className="lp-sections">
    {[3, 2].map((count, i) => (
      <div key={i} className="lp-section">
        <div className="skeleton" style={{ height: 10, width: 120, margin: "4px 4px 2px" }} />
        <SkeletonRows count={count} />
      </div>
    ))}
  </div>
);

/** Height of the slim month bar (.lp-mini in list-pages.css), without the safe area. */
const MINI_BAR_HEIGHT = 54;

/** Reads ?year=&month= (1-12), falling back to the current month. */
function useUrlMonth() {
  const params = useSearchParams();
  const year = parseInt(params.get("year") ?? "", 10);
  const month = parseInt(params.get("month") ?? "", 10);
  const now = appNow();
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12
    ? { year, month }
    : { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default function TransactionsBody() {
  const lang = useLang();
  const es = lang === "es";
  const t = useTranslations(lang);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { year, month } = useUrlMonth();
  const { data: transactions = [], isLoading, isFetching, isPlaceholderData } = useTransactions(year, month);
  const monthDataReady = !isLoading && !isPlaceholderData;
  const { data: categories } = useCategories();
  const jointAccountIds = useJointAccountIds();
  const [createOpen, setCreateOpen] = useCreateDialog();
  const [swipeArea, setSwipeArea] = useState<HTMLDivElement | null>(null);
  // Phones: once the summary card has scrolled away, a slim bar keeps the month and balance on top.
  const [summaryAway, setSummaryAway] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollToListRef = useRef(false);
  useEffect(() => {
    if (!swipeArea) return;
    // Away = under the bar (its 54px off the top), so the bar takes over as the card disappears.
    const observer = new IntersectionObserver(([entry]) => setSummaryAway(!entry.isIntersecting && entry.boundingClientRect.top < 0), {
      rootMargin: `-${MINI_BAR_HEIGHT}px 0px 0px 0px`,
    });
    observer.observe(swipeArea);
    return () => observer.disconnect();
  }, [swipeArea]);

  const now = appNow();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const goTo = (target: { year: number; month: number }) =>
    router.replace(`/transactions?year=${target.year}&month=${target.month}`, { scroll: false });
  const changeMonth = (delta: number) => goTo(shiftMonth(year, month, delta));
  const goToToday = () => goTo({ year: appNow().getFullYear(), month: appNow().getMonth() + 1 });
  const prefetch = (delta: number) => {
    const target = shiftMonth(year, month, delta);
    prefetchMonth(queryClient, target.year, target.month);
  };

  useSwipe(swipeArea, { onSwipeLeft: () => changeMonth(1), onSwipeRight: () => changeMonth(-1) }, 50);
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.closest("[role=dialog]")) return;
    if (e.key === "ArrowLeft") changeMonth(-1);
    else if (e.key === "ArrowRight") changeMonth(1);
    else if (e.key === "ArrowDown") goToToday();
  });
  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!monthDataReady || !scrollToListRef.current || !list) return;
    scrollToListRef.current = false;
    window.scrollTo({ top: list.getBoundingClientRect().top + window.scrollY - MINI_BAR_HEIGHT - 8 });
  }, [monthDataReady, year, month]);

  const counted = metricTransactions(transactions, categories, { jointAccountIds });
  const countedIds = new Set(counted.map((tx) => tx.id));
  const { income, expense } = sumByType(counted);
  const balance = income - expense;
  const spentRatio = income > 0 ? expense / income : null;
  const loadingMonth = isFetching || isPlaceholderData;
  const smooth = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
  /** From the slim bar: show the new month from its first day, the bar still on top (once it has rendered: the summary's height changes). */
  const changeMonthFromBar = (delta: number) => {
    scrollToListRef.current = true;
    changeMonth(delta);
  };
  const miniSummary = (
    <div className="lp-mini" data-shown={summaryAway} inert={!summaryAway}>
      <button type="button" className="lp-icon-btn" onClick={() => changeMonthFromBar(-1)} aria-label={es ? "Mes anterior" : "Previous month"}>
        <ChevronLeft className="size-5" strokeWidth={2} />
      </button>
      <button
        type="button"
        className="lp-mini-month"
        onClick={() => window.scrollTo({ top: 0, behavior: smooth() })}
        aria-label={es ? "Volver al resumen del mes" : "Back to the month summary"}
      >
        <span>{monthName(month, lang, "long")}</span>
        <span>{year}</span>
      </button>
      <button type="button" className="lp-icon-btn" onClick={() => changeMonthFromBar(1)} aria-label={es ? "Mes siguiente" : "Next month"}>
        <ChevronRight className="size-5" strokeWidth={2} />
      </button>
      <span className="lp-mini-balance">
        <small>Balance</small>
        <span className={balance > 0 ? "is-income" : balance < 0 ? "is-negative" : "is-muted"}>
          <Money value={balance} signed roll />
        </span>
      </span>
    </div>
  );

  const summary = (
    <div ref={setSwipeArea} className="lp-card lp-summary">
      <div className="lp-month">
        <button
          type="button"
          className="lp-icon-btn"
          onClick={() => changeMonth(-1)}
          onMouseEnter={() => prefetch(-1)}
          aria-label={es ? "Mes anterior" : "Previous month"}
        >
          <ChevronLeft className="size-5" strokeWidth={2} />
        </button>
        <div className="lp-month-title">
          <MonthPicker value={{ year, month }} onChange={goTo} />
          {loadingMonth && !isLoading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label={es ? "Cargando" : "Loading"} />
          ) : (
            !isCurrentMonth && (
              <button type="button" className="lp-chip" onClick={goToToday}>
                {es ? "Hoy" : "Today"}
              </button>
            )
          )}
        </div>
        <button
          type="button"
          className="lp-icon-btn"
          onClick={() => changeMonth(1)}
          onMouseEnter={() => prefetch(1)}
          aria-label={es ? "Mes siguiente" : "Next month"}
        >
          <ChevronRight className="size-5" strokeWidth={2} />
        </button>
      </div>

      <Bones
        name="transactions-summary"
        loading={isLoading || isPlaceholderData}
        className="lp-stack"
        fallback={
          <div className="lp-stats" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="lp-stat">
                <div className="skeleton" style={{ height: 9, width: "60%" }} />
                <div className="skeleton" style={{ height: 16, width: "80%", marginTop: 4 }} />
              </div>
            ))}
          </div>
        }
      >
        <div className="lp-stats">
          <div className="lp-stat">
            <span className="lp-label">{es ? "Ingresos" : "Income"}</span>
            <span className={`lp-stat-value ${income > 0 ? "is-income" : "is-muted"}`}>
              <Money value={income} roll />
            </span>
          </div>
          <div className="lp-stat">
            <span className="lp-label">{es ? "Gastos" : "Expenses"}</span>
            <span className={`lp-stat-value ${expense > 0 ? "" : "is-muted"}`}>
              <Money value={expense} roll />
            </span>
          </div>
          <div className="lp-stat">
            <span className="lp-label">Balance</span>
            <span className={`lp-stat-value ${balance > 0 ? "is-income" : balance < 0 ? "is-negative" : "is-muted"}`}>
              <Money value={balance} signed roll />
            </span>
          </div>
        </div>
        {spentRatio !== null && (
          <div className="lp-meter-row" title={es ? "Gastos sobre ingresos" : "Expenses over income"}>
            <div className="lp-meter">
              <span
                style={{
                  width: `${Math.min(spentRatio, 1) * 100}%`,
                  background: spentRatio > 1 ? "var(--danger)" : spentRatio > 0.8 ? "var(--warning)" : "var(--accent)",
                }}
              />
            </div>
            <span>
              {Math.round(spentRatio * 100)}% {es ? "gastado" : "spent"}
            </span>
          </div>
        )}
      </Bones>
    </div>
  );

  return (
    <div className="page-container lp-page fade-in">
      <CompactPageHeader title={t("transactions.title")} addLabel={t("transactions.add")} onAdd={() => setCreateOpen(true)} />
      {miniSummary}

      <div className="lp-layout">
        <aside className="lp-aside">{summary}</aside>

        <div className="lp-content" ref={listRef}>
          {monthDataReady && transactions.length === 0 && (
            <div className="lp-card lp-empty lp-fade" key={`empty-${year}-${month}`}>
              <div className="lp-empty-icon">
                <TransactionsIcon size={24} strokeWidth={2.5} />
              </div>
              <p className="lp-empty-title">{t("transactions.emptyThisMonth")}</p>
              <button type="button" className="lp-chip" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" strokeWidth={2.5} />
                {t("transactions.add")}
              </button>
            </div>
          )}

          {(!monthDataReady || transactions.length > 0) && (
            <Bones name="transactions" loading={!monthDataReady} fallback={<ListSkeleton />}>
              <div className="lp-fade" key={`list-${year}-${month}`}>
                <TransactionDayList transactions={transactions} countedIds={countedIds} peek />
              </div>
            </Bones>
          )}
        </div>
      </div>

      <TransactionSheet open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
