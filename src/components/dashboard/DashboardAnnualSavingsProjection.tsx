"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { useTransactionsRange } from "@/hooks/useTransactions";
import { appNow, monthKey } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { metricTransactions, sumByType } from "@/lib/metricsFilters";

const signClass = (n: number) => (n >= 0 ? "text-success" : "text-danger");

/** Savings of the completed months of this year and their projection to December. */
export default function DashboardAnnualSavingsProjection() {
  const lang = useLang();
  const t = useTranslations(lang);
  const now = appNow();
  const year = now.getFullYear();
  const completedMonths = now.getMonth();
  const { byMonth, isLoading } = useTransactionsRange();
  const { data: categories } = useCategories();
  const { data: accounts = [] } = useAccounts();

  let totalSaved = 0;
  for (let m = 1; m <= completedMonths; m++) {
    const { income, expense } = sumByType(metricTransactions(byMonth.get(monthKey(year, m)) ?? [], categories));
    totalSaved += income - expense;
  }
  const avgMonthly = completedMonths > 0 ? totalSaved / completedMonths : 0;
  const projectedRemaining = avgMonthly * (12 - completedMonths);
  const projectedTotal = totalSaved + projectedRemaining;
  const currentBalance = (accounts as { balance?: number }[]).reduce((sum, acc) => sum + Number(acc.balance ?? 0), 0);
  const TrendIcon = totalSaved > 0 ? TrendingUp : totalSaved < 0 ? TrendingDown : Minus;

  return (
    <DashboardCard
      title={t("dashboard.annualSavings")}
      description={!isLoading && year}
      loading={isLoading}
      contentClassName="space-y-3"
    >
      <div className="flex items-center gap-2">
        <TrendIcon className={`size-5 ${signClass(totalSaved)}`} strokeWidth={2} />
        <span className={`text-2xl font-bold ${signClass(totalSaved)}`}>
          {totalSaved >= 0 ? "+" : ""}
          <SensitiveAmount>{formatCurrency(totalSaved)}</SensitiveAmount>
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("dashboard.savedSoFar")} ({completedMonths} {lang === "es" ? "meses" : "months"})
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/50 p-3 space-y-1">
          <p className="text-xs text-muted-foreground">{lang === "es" ? "Media mensual" : "Monthly avg"}</p>
          <p className={`text-sm font-semibold ${signClass(avgMonthly)}`}>
            {avgMonthly >= 0 ? "+" : ""}
            <SensitiveAmount>{formatCurrency(avgMonthly)}</SensitiveAmount>
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 space-y-1">
          <p className="text-xs text-muted-foreground">{t("dashboard.projectedYear")}</p>
          <p className={`text-sm font-semibold ${signClass(projectedTotal)}`}>
            {projectedTotal >= 0 ? "+" : ""}
            <SensitiveAmount>{formatCurrency(projectedTotal)}</SensitiveAmount>
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 space-y-1 col-span-2">
          <p className="text-xs text-muted-foreground">{lang === "es" ? "Balance estimado fin de año" : "Estimated year-end balance"}</p>
          <p className="text-sm font-semibold">
            <SensitiveAmount>{formatCurrency(currentBalance + projectedRemaining)}</SensitiveAmount>
          </p>
        </div>
      </div>
    </DashboardCard>
  );
}
