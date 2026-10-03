"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { Bones } from "@/components/Bones";
import { TransactionsIcon } from "@/components/icons";
import { CompactPageHeader } from "@/components/PageHeader";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { signed, TransactionDayList } from "@/components/TransactionDayList";
import { TransactionSheet } from "@/components/TransactionSheet";
import { useJointAccountIds } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useCreateDialog } from "@/hooks/useCreateDialog";
import { useLang } from "@/hooks/useLang";
import { useSwipe } from "@/hooks/useSwipe";
import { prefetchMonth, useTransactions } from "@/hooks/useTransactions";
import { appNow, shiftMonth } from "@/lib/date";
import { formatCurrency, monthName } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { metricTransactions, sumMetricsByType } from "@/lib/metricsFilters";

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

  const counted = metricTransactions(transactions, categories, { jointAccountIds });
  const countedIds = new Set(counted.map((tx) => tx.id));
  const { income, expense } = sumMetricsByType(counted);
  const balance = income - expense;
  const spentRatio = income > 0 ? expense / income : null;
  const loadingMonth = isFetching || isPlaceholderData;

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
          <span>{monthName(month, lang, "long")}</span>
          <span className="lp-month-year">{year}</span>
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
        <div className="lp-stats lp-fade" key={`stats-${year}-${month}`}>
          <div className="lp-stat">
            <span className="lp-label">{es ? "Ingresos" : "Income"}</span>
            <span className={`lp-stat-value ${income > 0 ? "is-income" : "is-muted"}`}>
              <SensitiveAmount>{formatCurrency(income)}</SensitiveAmount>
            </span>
          </div>
          <div className="lp-stat">
            <span className="lp-label">{es ? "Gastos" : "Expenses"}</span>
            <span className={`lp-stat-value ${expense > 0 ? "" : "is-muted"}`}>
              <SensitiveAmount>{formatCurrency(expense)}</SensitiveAmount>
            </span>
          </div>
          <div className="lp-stat">
            <span className="lp-label">Balance</span>
            <span className={`lp-stat-value ${balance > 0 ? "is-income" : balance < 0 ? "is-negative" : "is-muted"}`}>
              <SensitiveAmount>{balance === 0 ? formatCurrency(0) : signed(balance)}</SensitiveAmount>
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

      <div className="lp-layout">
        <aside className="lp-aside">{summary}</aside>

        <div className="lp-content">
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
                <TransactionDayList transactions={transactions} countedIds={countedIds} />
              </div>
            </Bones>
          )}
        </div>
      </div>

      <TransactionSheet open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
