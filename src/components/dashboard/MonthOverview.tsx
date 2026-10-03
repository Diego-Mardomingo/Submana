"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { Bones } from "@/components/Bones";
import { BudgetRowContent } from "@/components/BudgetsBody";
import { TransactionRow, transactionEmoji } from "@/components/TransactionDayList";
import { TransactionSheet } from "@/components/TransactionSheet";
import { useBudgets } from "@/hooks/useBudgets";
import { useCategoryLookup } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { useSwipe } from "@/hooks/useSwipe";
import { prefetchMonth, useMetricTransactions, type Transaction } from "@/hooks/useTransactions";
import { appNow, monthKey, shiftMonth } from "@/lib/date";
import { monthName } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { metricAmount, sumMetricsByType } from "@/lib/metricsFilters";
import { cn } from "@/lib/utils";
import { CardHead, money, SeeAll, signClass, signedMoney, Stat } from "./shared";

type Month = { year: number; month: number };

const currentMonth = (): Month => ({ year: appNow().getFullYear(), month: appNow().getMonth() + 1 });

function useMonthTotals({ year, month }: Month) {
  const { data, isLoading, isFetching } = useMetricTransactions(year, month);
  const { income, expense } = sumMetricsByType(data);
  return { data, income, expense, balance: income - expense, isLoading, isFetching };
}

/** Income, expenses and net result of the month, compared with the previous one. */
function SummaryCard({ month, es }: { month: Month; es: boolean }) {
  const current = useMonthTotals(month);
  const previous = useMonthTotals(shiftMonth(month.year, month.month, -1));
  // No comparison until the month has movements (otherwise every month would start at -100%).
  const hasData = current.income > 0 || current.expense > 0;
  const change = !hasData || previous.balance === 0 ? null : ((current.balance - previous.balance) / Math.abs(previous.balance)) * 100;
  const spentRatio = current.income > 0 ? current.expense / current.income : null;

  return (
    <div className="lp-card dash-card">
      <CardHead title={es ? "Resumen" : "Summary"}>
        {change !== null && !current.isLoading && !previous.isLoading && (
          <span
            className={cn("dash-badge", change >= 0 ? "is-up" : "is-down")}
            title={es ? "Resultado frente al mes anterior" : "Result vs previous month"}
          >
            {change >= 0 ? <TrendingUp className="size-3" strokeWidth={2.5} /> : <TrendingDown className="size-3" strokeWidth={2.5} />}
            {change >= 0 ? "+" : ""}
            {Math.abs(change) >= 1000 ? Math.round(change) : change.toFixed(1)}%
          </span>
        )}
      </CardHead>
      <Bones name="dashboard-summary" loading={current.isLoading} fallback={<div className="skeleton dash-block-skeleton" aria-hidden />}>
        <div className="dash-summary lp-fade" key={monthKey(month.year, month.month)}>
          <div>
            <span className={cn("lp-hero-value", signClass(current.balance))}>{signedMoney(current.balance)}</span>
            <span className="dash-hero-caption">{es ? "Resultado del mes" : "Net this month"}</span>
          </div>
          <div className="lp-stats dash-summary-stats">
            <Stat label={es ? "Ingresos" : "Income"} value={money(current.income)} className={current.income > 0 ? "is-income" : "is-muted"} />
            <Stat label={es ? "Gastos" : "Expenses"} value={money(current.expense)} className={current.expense > 0 ? undefined : "is-muted"} />
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
        </div>
      </Bones>
    </div>
  );
}

function BudgetsCard({ month, es }: { month: Month; es: boolean }) {
  const t = useTranslations(es ? "es" : "en");
  const { data: budgets = [], isLoading, isPlaceholderData } = useBudgets(monthKey(month.year, month.month));
  const categories = useCategoryLookup();

  return (
    <div className="lp-card dash-card dash-card--list">
      <CardHead title={t("home.budgetsTitle")}>
        <SeeAll href="/budgets" label={es ? "Ver todos" : "See all"} />
      </CardHead>
      {!isLoading && budgets.length === 0 ? (
        <div className="dash-empty">
          <p>{t("home.noActiveBudgets")}</p>
          <Link href="/budgets" className="lp-chip">
            {t("budgets.add")}
          </Link>
        </div>
      ) : (
        <Bones name="dashboard-budgets" loading={isLoading} fallback={<div className="skeleton dash-block-skeleton" aria-hidden />}>
          <div className={cn("lp-group dash-list", isPlaceholderData && "is-refreshing")}>
            {budgets.map((budget) => (
              <Link key={budget.id} href="/budgets" className="lp-row">
                <BudgetRowContent budget={budget} categories={categories} />
              </Link>
            ))}
          </div>
        </Bones>
      )}
    </div>
  );
}

function TopExpensesCard({ month, es }: { month: Month; es: boolean }) {
  const t = useTranslations(es ? "es" : "en");
  const { data, isLoading } = useMetricTransactions(month.year, month.month);
  const categories = useCategoryLookup();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const top = data
    .filter((tx) => tx.type === "expense")
    .sort((a, b) => metricAmount(b) - metricAmount(a))
    .slice(0, 5);

  return (
    <div className="lp-card dash-card dash-card--list">
      <CardHead title={t("dashboard.topExpenses")}>
        <SeeAll href={`/transactions?year=${month.year}&month=${month.month}`} label={es ? "Ver todas" : "See all"} />
      </CardHead>
      {!isLoading && top.length === 0 ? (
        <p className="dash-empty">{t("home.noExpensesThisMonth")}</p>
      ) : (
        <Bones name="dashboard-top-expenses" loading={isLoading} fallback={<div className="skeleton dash-block-skeleton" aria-hidden />}>
          <div className="lp-group dash-list">
            {top.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                emoji={transactionEmoji(categories, tx)}
                fallbackLabel={t("transactions.expense")}
                onOpen={setEditing}
              />
            ))}
          </div>
        </Bones>
      )}
      <TransactionSheet open={!!editing} onOpenChange={(open) => !open && setEditing(null)} transaction={editing} />
    </div>
  );
}

/** Month-based widgets driven by one month switcher (arrows, swipe, "Today" chip). */
export default function MonthOverview() {
  const lang = useLang();
  const es = lang === "es";
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth);
  const [swipeArea, setSwipeArea] = useState<HTMLElement | null>(null);
  const { isFetching } = useMetricTransactions(month.year, month.month);
  const now = currentMonth();
  const isCurrent = month.year === now.year && month.month === now.month;

  const changeMonth = (delta: number) => setMonth((m) => shiftMonth(m.year, m.month, delta));
  const prefetch = (delta: number) => {
    const target = shiftMonth(month.year, month.month, delta);
    prefetchMonth(queryClient, target.year, target.month);
  };
  useSwipe(swipeArea, { onSwipeLeft: () => changeMonth(1), onSwipeRight: () => changeMonth(-1) }, 50);

  return (
    <section ref={setSwipeArea} className="dash-section" aria-label={es ? "Mes" : "Month"}>
      <div className="lp-month dash-month">
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
          <span>{monthName(month.month, lang, "long")}</span>
          <span className="lp-month-year">{month.year}</span>
          {isFetching ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label={es ? "Cargando" : "Loading"} />
          ) : (
            !isCurrent && (
              <button type="button" className="lp-chip" onClick={() => setMonth(currentMonth())}>
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
      <div className="dash-month-grid">
        <SummaryCard month={month} es={es} />
        <BudgetsCard month={month} es={es} />
        <TopExpensesCard month={month} es={es} />
      </div>
    </section>
  );
}
