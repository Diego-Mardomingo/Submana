"use client";

import { useMemo, useEffect, useState } from "react";
import { useTransactionsRange, type DateRange } from "@/hooks/useTransactionsRange";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { Line } from "react-chartjs-2";
import { Spinner } from "@/components/ui/spinner";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { tooltipConfig, getChartColors } from "@/lib/chartConfig";
import { detectTransferIds } from "@/lib/transferDetection";

type Tx = { id: string; amount?: number; type?: string; date?: string; account_id?: string };

export default function DashboardAnnualSavingsProjection() {
  const lang = useLang();
  const t = useTranslations(lang);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const range: DateRange = {
    startYear: currentYear,
    startMonth: 1,
    endYear: currentYear,
    endMonth: 12,
  };

  const { transactionsByMonth, monthLabels, isLoading } = useTransactionsRange(undefined, range);

  const [colors, setColors] = useState({ success: "#10b981", danger: "#ef4444" });
  useEffect(() => {
    const c = getChartColors();
    setColors({
      success: c.success || "#10b981",
      danger: c.danger || "#ef4444",
    });
  }, []);

  const data = useMemo(() => {
    const monthlySavings: number[] = [];
    let totalSaved = 0;

    const completedMonths = Math.max(0, currentMonth - 1);

    for (const { key } of monthLabels) {
      const [, m] = key.split("-").map(Number);
      if (m >= currentMonth) break;

      const txs = (transactionsByMonth[key] ?? []) as Tx[];
      const transferIds = detectTransferIds(
        txs.map((tx) => ({ id: tx.id, amount: Number(tx.amount) || 0, type: tx.type || "", date: tx.date || "", account_id: tx.account_id }))
      );

      let income = 0;
      let expense = 0;
      for (const tx of txs) {
        if (transferIds.has(tx.id)) continue;
        const amt = Number(tx.amount) || 0;
        if (tx.type === "income") income += amt;
        else expense += amt;
      }
      const savings = income - expense;
      monthlySavings.push(Math.round(savings * 100) / 100);
      totalSaved += savings;
    }

    const avgMonthlySavings = completedMonths > 0 ? totalSaved / completedMonths : 0;
    const projectedAnnual = avgMonthlySavings * 12;
    const remainingMonths = 12 - completedMonths;
    const projectedTotal = totalSaved + avgMonthlySavings * remainingMonths;

    return {
      monthlySavings,
      totalSaved: Math.round(totalSaved * 100) / 100,
      avgMonthlySavings: Math.round(avgMonthlySavings * 100) / 100,
      projectedAnnual: Math.round(projectedAnnual * 100) / 100,
      projectedTotal: Math.round(projectedTotal * 100) / 100,
      completedMonths,
    };
  }, [transactionsByMonth, monthLabels, currentMonth]);

  const sparkColor = data.totalSaved >= 0 ? colors.success : colors.danger;

  const sparkLabels = useMemo(() => {
    const short = lang === "es"
      ? ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
      : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return short.slice(0, data.completedMonths);
  }, [lang, data.completedMonths]);

  const sparkData = useMemo(() => {
    let cumulative = 0;
    const cumulativeData = data.monthlySavings.slice(0, data.completedMonths).map((v) => {
      cumulative += v;
      return Math.round(cumulative * 100) / 100;
    });

    return {
      labels: sparkLabels,
      datasets: [{
        data: cumulativeData,
        borderColor: sparkColor,
        backgroundColor: sparkColor + "15",
        borderWidth: 1.5,
        pointRadius: 2,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.3,
      }],
    };
  }, [data.monthlySavings, data.completedMonths, sparkLabels, sparkColor]);

  const sparkOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      tooltip: {
        ...tooltipConfig(),
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) => formatCurrency(ctx.parsed.y ?? 0),
        },
      },
      legend: { display: false },
    },
    scales: {
      x: { display: true, ticks: { font: { size: 8 }, maxRotation: 0 }, grid: { display: false }, border: { display: false } },
      y: { display: false },
    },
  }), []);

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.annualSavings")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="size-6 text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = data.totalSaved > 0 ? TrendingUp : data.totalSaved < 0 ? TrendingDown : Minus;
  const trendColor = data.totalSaved >= 0 ? "text-success" : "text-danger";

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-muted-foreground">
          {t("dashboard.annualSavings")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{currentYear}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendIcon className={`size-5 ${trendColor}`} strokeWidth={2} />
          <span className={`text-2xl font-bold ${trendColor}`}>
            {data.totalSaved >= 0 ? "+" : ""}{formatCurrency(data.totalSaved)}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("dashboard.savedSoFar")} ({data.completedMonths} {lang === "es" ? "meses" : "months"})
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-xs text-muted-foreground">
              {lang === "es" ? "Media mensual" : "Monthly avg"}
            </p>
            <p className={`text-sm font-semibold ${data.avgMonthlySavings >= 0 ? "text-success" : "text-danger"}`}>
              {data.avgMonthlySavings >= 0 ? "+" : ""}{formatCurrency(data.avgMonthlySavings)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <p className="text-xs text-muted-foreground">
              {t("dashboard.projectedYear")}
            </p>
            <p className={`text-sm font-semibold ${data.projectedTotal >= 0 ? "text-success" : "text-danger"}`}>
              {data.projectedTotal >= 0 ? "+" : ""}{formatCurrency(data.projectedTotal)}
            </p>
          </div>
        </div>

        {data.completedMonths > 1 && (
          <div className="h-20">
            <Line data={sparkData} options={sparkOptions} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
