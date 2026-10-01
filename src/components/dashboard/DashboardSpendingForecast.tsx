"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { Progress } from "@/components/ui/progress";
import { useLang } from "@/hooks/useLang";
import { useMetricTransactions } from "@/hooks/useTransactions";
import { appNow, shiftMonth } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { sumByType } from "@/lib/metricsFilters";

export default function DashboardSpendingForecast() {
  const lang = useLang();
  const t = useTranslations(lang);
  const now = appNow();
  const prev = shiftMonth(now.getFullYear(), now.getMonth() + 1, -1);
  const { data: transactions, isLoading } = useMetricTransactions(now.getFullYear(), now.getMonth() + 1);
  const { data: prevTransactions } = useMetricTransactions(prev.year, prev.month);

  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const spent = sumByType(transactions.filter((tx) => tx.type === "expense")).expense;
  const prevTotal = sumByType(prevTransactions.filter((tx) => tx.type === "expense")).expense;
  const dailyAvg = spent / dayOfMonth;
  const projected = dailyAvg * daysInMonth;
  const projectedVsPrev = prevTotal > 0 ? ((projected - prevTotal) / prevTotal) * 100 : 0;
  const isOver = projectedVsPrev > 0;
  const es = lang === "es";

  return (
    <DashboardCard
      title={t("dashboard.spendingForecast")}
      description={!isLoading && (es ? `Día ${dayOfMonth} de ${daysInMonth}` : `Day ${dayOfMonth} of ${daysInMonth}`)}
      loading={isLoading}
      contentClassName="space-y-4"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{es ? "Gastado" : "Spent"}</span>
          <span className="font-semibold">
            <SensitiveAmount>{formatCurrency(spent)}</SensitiveAmount>
          </span>
        </div>
        {prevTotal > 0 && (
          <>
            <Progress value={Math.min((spent / prevTotal) * 100, 100)} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">
              {es ? "vs mes anterior" : "vs last month"}: <SensitiveAmount>{formatCurrency(prevTotal)}</SensitiveAmount>
            </p>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/50 p-3 space-y-1">
          <p className="text-xs text-muted-foreground">{es ? "Media diaria" : "Daily avg"}</p>
          <p className="text-sm font-semibold">
            <SensitiveAmount>{formatCurrency(dailyAvg)}</SensitiveAmount>
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 space-y-1">
          <p className="text-xs text-muted-foreground">{es ? "Proyección" : "Projected"}</p>
          <div className="flex items-center gap-1">
            <p className="text-sm font-semibold">
              <SensitiveAmount>{formatCurrency(projected)}</SensitiveAmount>
            </p>
            {prevTotal > 0 &&
              (isOver ? (
                <TrendingUp className="size-3.5 text-danger" strokeWidth={2} />
              ) : (
                <TrendingDown className="size-3.5 text-success" strokeWidth={2} />
              ))}
          </div>
        </div>
      </div>

      {prevTotal > 0 && (
        <p className={`text-xs text-center ${isOver ? "text-danger" : "text-success"}`}>
          {isOver ? "+" : ""}
          {projectedVsPrev.toFixed(0)}%{" "}
          {isOver ? (es ? "más que el mes pasado" : "more than last month") : es ? "menos que el mes pasado" : "less than last month"}
        </p>
      )}
    </DashboardCard>
  );
}
