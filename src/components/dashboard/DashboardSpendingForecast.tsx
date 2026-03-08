"use client";

import { useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { formatCurrency } from "@/lib/format";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { TrendingUp, TrendingDown } from "lucide-react";
import { detectTransferIds } from "@/lib/transferDetection";
import { filterForMetrics } from "@/lib/metricsFilters";
import { useCategories } from "@/hooks/useCategories";

type Tx = { id: string; amount?: number; type?: string; date?: string; account_id?: string; category_id?: string | null; subcategory_id?: string | null };

export default function DashboardSpendingForecast() {
  const lang = useLang();
  const t = useTranslations(lang);
  const now = new Date();
  const { data: transactions = [], isLoading } = useTransactions(now.getFullYear(), now.getMonth() + 1);
  const { data: categoriesData } = useCategories();

  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const { data: prevTransactions = [] } = useTransactions(prevYear, prevMonth);

  const forecast = useMemo(() => {
    const ctx = {
      defaultCategories: categoriesData?.defaultCategories ?? [],
      userCategories: categoriesData?.userCategories ?? [],
    };
    const today = new Date();
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    const txList = transactions as Tx[];
    const transferIds = detectTransferIds(txList.map((tx) => ({ id: tx.id, amount: Number(tx.amount) || 0, type: tx.type || "", date: tx.date || "", account_id: tx.account_id })));
    const forMetrics = filterForMetrics(
      txList.filter((tx) => tx.type === "expense" && !transferIds.has(tx.id)),
      ctx
    );

    let totalSpent = 0;
    for (const tx of forMetrics) {
      totalSpent += Number(tx.amount) || 0;
    }

    const prevList = prevTransactions as Tx[];
    const prevTransferIds = detectTransferIds(prevList.map((tx) => ({ id: tx.id, amount: Number(tx.amount) || 0, type: tx.type || "", date: tx.date || "", account_id: tx.account_id })));
    const prevForMetrics = filterForMetrics(
      prevList.filter((tx) => tx.type === "expense" && !prevTransferIds.has(tx.id)),
      ctx
    );

    let prevTotal = 0;
    for (const tx of prevForMetrics) {
      prevTotal += Number(tx.amount) || 0;
    }

    const dailyAvg = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0;
    const projected = dailyAvg * daysInMonth;
    const progressPct = prevTotal > 0 ? Math.min((totalSpent / prevTotal) * 100, 100) : 0;
    const projectedVsPrev = prevTotal > 0 ? ((projected - prevTotal) / prevTotal) * 100 : 0;

    return {
      totalSpent: Math.round(totalSpent * 100) / 100,
      projected: Math.round(projected * 100) / 100,
      prevTotal: Math.round(prevTotal * 100) / 100,
      dailyAvg: Math.round(dailyAvg * 100) / 100,
      dayOfMonth,
      daysInMonth,
      progressPct,
      projectedVsPrev,
    };
  }, [transactions, prevTransactions, categoriesData]);

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.spendingForecast")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="size-6 text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isOver = forecast.projectedVsPrev > 0;

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-muted-foreground">
          {t("dashboard.spendingForecast")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {lang === "es"
            ? `Día ${forecast.dayOfMonth} de ${forecast.daysInMonth}`
            : `Day ${forecast.dayOfMonth} of ${forecast.daysInMonth}`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {lang === "es" ? "Gastado" : "Spent"}
            </span>
            <span className="font-semibold">
              <SensitiveAmount>{formatCurrency(forecast.totalSpent)}</SensitiveAmount>
            </span>
          </div>
          {forecast.prevTotal > 0 && (
            <Progress value={forecast.progressPct} className="h-2" />
          )}
          {forecast.prevTotal > 0 && (
            <p className="text-xs text-muted-foreground text-right">
              {lang === "es" ? "vs mes anterior" : "vs last month"}:{" "}
              <SensitiveAmount>{formatCurrency(forecast.prevTotal)}</SensitiveAmount>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-xs text-muted-foreground">
              {lang === "es" ? "Media diaria" : "Daily avg"}
            </p>
            <p className="text-sm font-semibold">
              <SensitiveAmount>{formatCurrency(forecast.dailyAvg)}</SensitiveAmount>
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-xs text-muted-foreground">
              {lang === "es" ? "Proyección" : "Projected"}
            </p>
            <div className="flex items-center gap-1">
              <p className="text-sm font-semibold">
                <SensitiveAmount>{formatCurrency(forecast.projected)}</SensitiveAmount>
              </p>
              {forecast.prevTotal > 0 && (
                isOver
                  ? <TrendingUp className="size-3.5 text-danger" strokeWidth={2} />
                  : <TrendingDown className="size-3.5 text-success" strokeWidth={2} />
              )}
            </div>
          </div>
        </div>

        {forecast.prevTotal > 0 && (
          <p className={`text-xs text-center ${isOver ? "text-danger" : "text-success"}`}>
            {isOver
              ? (lang === "es" ? `+${forecast.projectedVsPrev.toFixed(0)}% más que el mes pasado` : `+${forecast.projectedVsPrev.toFixed(0)}% more than last month`)
              : (lang === "es" ? `${forecast.projectedVsPrev.toFixed(0)}% menos que el mes pasado` : `${forecast.projectedVsPrev.toFixed(0)}% less than last month`)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
