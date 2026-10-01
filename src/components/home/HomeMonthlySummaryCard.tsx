"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { Badge } from "@/components/ui/badge";
import { useLang } from "@/hooks/useLang";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";
import { useMetricTransactions } from "@/hooks/useTransactions";
import { shiftMonth } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { sumByType } from "@/lib/metricsFilters";
import styles from "./HomeMonthlySummaryCard.module.css";

function useMonthTotals(year: number, month: number) {
  const { data, isLoading, isFetching } = useMetricTransactions(year, month);
  const { income, expense } = sumByType(data);
  return { income, expense, balance: income - expense, isLoading, isFetching };
}

export default function HomeMonthlySummaryCard() {
  const lang = useLang();
  const t = useTranslations(lang);
  const nav = useMonthNavigation(lang);
  const prev = shiftMonth(nav.year, nav.month, -1);
  const current = useMonthTotals(nav.year, nav.month);
  const previous = useMonthTotals(prev.year, prev.month);
  const change = previous.balance === 0 ? null : ((current.balance - previous.balance) / Math.abs(previous.balance)) * 100;

  return (
    <DashboardCard
      className="home-card"
      title={t("home.monthlySummary")}
      action={
        change !== null &&
        !current.isLoading && (
          <Badge
            variant={change >= 0 ? "default" : "destructive"}
            className={change >= 0 ? "bg-emerald-600 hover:bg-emerald-600 text-white" : ""}
          >
            {change >= 0 ? <TrendingUp className="mr-1 size-3" /> : <TrendingDown className="mr-1 size-3" />}
            {change >= 0 ? "+" : ""}
            {change.toFixed(1)}%
          </Badge>
        )
      }
      nav={nav}
      loading={current.isLoading}
      refreshing={current.isFetching || previous.isFetching}
      contentClassName="flex flex-col"
    >
      <div className={styles.row}>
        <div className={styles.incomeSection}>
          <p className={styles.label}>{t("home.totalIncome")}</p>
          <p className={styles.incomeValue}>
            +<SensitiveAmount>{formatCurrency(current.income)}</SensitiveAmount>
          </p>
        </div>
        <div className={styles.expenseSection}>
          <p className={styles.label}>{t("home.totalExpenses")}</p>
          <p className={styles.expenseValue}>
            -<SensitiveAmount>{formatCurrency(current.expense)}</SensitiveAmount>
          </p>
        </div>
      </div>
      <hr className={styles.divider} />
      <div className={styles.balanceSection}>
        <p
          className={styles.balanceValue}
          style={{ color: current.balance > 0 ? "var(--success)" : current.balance < 0 ? "var(--danger)" : "var(--accent)" }}
        >
          {current.balance >= 0 ? "+" : ""}
          <SensitiveAmount>{formatCurrency(current.balance)}</SensitiveAmount>
        </p>
        <p className={styles.balanceLabel}>{t("home.monthlyBalance")}</p>
      </div>
    </DashboardCard>
  );
}
