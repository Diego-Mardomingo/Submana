"use client";

import { useState } from "react";
import { Bones } from "@/components/Bones";
import { MonthRangePicker } from "@/components/dashboard/MonthRangePicker";
import { useAccounts, useJointAccountIds } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useTransactionsRange, type DateRange } from "@/hooks/useTransactions";
import { appNow, monthKey, shiftMonth } from "@/lib/date";
import { monthKeyLabel } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import type { Lang } from "@/lib/i18n/ui";
import { metricTransactions, sumMetricsByType } from "@/lib/metricsFilters";
import { cn } from "@/lib/utils";
import { CardHead, IncomeExpenseBars, money, signClass, signedMoney, Stat } from "./shared";

/** Last 12 months, current one included. */
function lastYearRange(): DateRange {
  const now = appNow();
  const start = shiftMonth(now.getFullYear(), now.getMonth() + 1, -11);
  return { startYear: start.year, startMonth: start.month, endYear: now.getFullYear(), endMonth: now.getMonth() + 1 };
}

/** Monthly income vs expense bars with the averages of the shown range. */
export function IncomeExpenseCard({ lang }: { lang: Lang }) {
  const es = lang === "es";
  const t = useTranslations(lang);
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const range = customRange ?? lastYearRange();
  const { byMonth, keys, availableRange, isLoading } = useTransactionsRange(undefined, range);
  const { data: categories } = useCategories();
  const jointAccountIds = useJointAccountIds();

  const totals = keys.map((key) => sumMetricsByType(metricTransactions(byMonth.get(key) ?? [], categories, { jointAccountIds })));
  const avg = (pick: (m: (typeof totals)[number]) => number) => (totals.length ? totals.reduce((sum, m) => sum + pick(m), 0) / totals.length : 0);
  const avgIncome = avg((m) => m.income);
  const avgExpense = avg((m) => m.expense);

  return (
    <div className="lp-card dash-card dash-card--wide">
      <CardHead title={t("dashboard.incomeVsExpense")}>
        {!isLoading && (
          <MonthRangePicker shown={range} available={availableRange} isCustom={!!customRange} onChange={setCustomRange} monthCount={keys.length} />
        )}
      </CardHead>
      <div className="dash-legend" aria-hidden>
        <span>
          <i style={{ background: "var(--success)" }} />
          {es ? "Ingresos" : "Income"}
        </span>
        <span>
          <i style={{ background: "var(--danger)" }} />
          {es ? "Gastos" : "Expenses"}
        </span>
      </div>
      <div className="dash-chart">
        {isLoading ? (
          <div className="skeleton dash-chart-skeleton" />
        ) : (
          <IncomeExpenseBars
            labels={keys.map((key) => monthKeyLabel(key, lang))}
            income={totals.map((m) => m.income)}
            expense={totals.map((m) => m.expense)}
            es={es}
          />
        )}
      </div>
      {!isLoading && (
        <div className="lp-stats dash-card-foot">
          <Stat label={es ? "Ingreso medio" : "Avg income"} value={money(avgIncome)} className={avgIncome > 0 ? "is-income" : "is-muted"} />
          <Stat label={es ? "Gasto medio" : "Avg expense"} value={money(avgExpense)} />
          <Stat label={es ? "Ahorro medio" : "Avg savings"} value={signedMoney(avgIncome - avgExpense)} className={signClass(avgIncome - avgExpense)} />
        </div>
      )}
    </div>
  );
}

/** Savings of the completed months of this year and their projection to December. */
export function SavingsProjectionCard({ lang }: { lang: Lang }) {
  const es = lang === "es";
  const t = useTranslations(lang);
  const now = appNow();
  const year = now.getFullYear();
  const completedMonths = now.getMonth();
  const { byMonth, isLoading } = useTransactionsRange();
  const { data: categories } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const jointAccountIds = useJointAccountIds();

  let saved = 0;
  for (let m = 1; m <= completedMonths; m++) {
    const { income, expense } = sumMetricsByType(metricTransactions(byMonth.get(monthKey(year, m)) ?? [], categories, { jointAccountIds }));
    saved += income - expense;
  }
  const avgMonthly = completedMonths > 0 ? saved / completedMonths : 0;
  const projectedRemaining = avgMonthly * (12 - completedMonths);
  const currentBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance ?? 0), 0);

  return (
    <div className="lp-card dash-card">
      <CardHead title={`${es ? "Ahorro" : "Savings"} ${year}`} />
      <Bones name="dashboard-savings" loading={isLoading} fallback={<div className="skeleton dash-block-skeleton" aria-hidden />}>
        <div className="dash-summary">
          <div>
            <span className={cn("lp-hero-value", signClass(saved))}>{signedMoney(saved)}</span>
            <span className="dash-hero-caption">
              {t("dashboard.savedSoFar")} · {completedMonths} {es ? (completedMonths === 1 ? "mes" : "meses") : completedMonths === 1 ? "month" : "months"}
            </span>
          </div>
          <div className="dash-kv">
            <div>
              <span>{es ? "Media mensual" : "Monthly average"}</span>
              <span className={signClass(avgMonthly)}>{signedMoney(avgMonthly)}</span>
            </div>
            <div>
              <span>{t("dashboard.projectedYear")}</span>
              <span className={signClass(saved + projectedRemaining)}>{signedMoney(saved + projectedRemaining)}</span>
            </div>
            <div>
              <span>{es ? "Saldo estimado a fin de año" : "Estimated year-end balance"}</span>
              <span>{money(currentBalance + projectedRemaining)}</span>
            </div>
          </div>
        </div>
      </Bones>
    </div>
  );
}
