"use client";

import { useMemo } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Line } from "react-chartjs-2";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { useLang } from "@/hooks/useLang";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";
import { useMetricTransactions } from "@/hooks/useTransactions";
import { tooltipConfig, useChartTheme } from "@/lib/chartConfig";
import { shiftMonth } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { runningTotals, sumByType } from "@/lib/metricsFilters";

export default function DashboardCashFlowSummary() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { colors } = useChartTheme();
  const nav = useMonthNavigation(lang);
  const prev = shiftMonth(nav.year, nav.month, -1);
  const { data: transactions, isLoading } = useMetricTransactions(nav.year, nav.month);
  const { data: prevTransactions } = useMetricTransactions(prev.year, prev.month);

  const data = useMemo(() => {
    const { income, expense } = sumByType(transactions);
    const prevTotals = sumByType(prevTransactions);
    const net = income - expense;
    const prevNet = prevTotals.income - prevTotals.expense;

    // Cumulative net per day of the month.
    const dailyNet = new Array(new Date(nav.year, nav.month, 0).getDate()).fill(0);
    for (const tx of transactions) {
      const day = new Date(tx.date).getDate() - 1;
      if (day >= 0 && day < dailyNet.length) dailyNet[day] += tx.type === "income" ? tx.amount : -tx.amount;
    }
    const sparkline = runningTotals(dailyNet);

    return {
      income,
      expense,
      net,
      change: prevNet !== 0 ? Math.round(((net - prevNet) / Math.abs(prevNet)) * 1000) / 10 : 0,
      sparkline,
    };
  }, [transactions, prevTransactions, nav.year, nav.month]);

  const sparkColor = data.net >= 0 ? colors.success : colors.danger;
  const trendColor = data.net >= 0 ? "text-success" : "text-danger";
  const TrendIcon = data.net > 0 ? TrendingUp : data.net < 0 ? TrendingDown : Minus;

  return (
    <DashboardCard title={t("dashboard.cashFlowNet")} nav={nav} loading={isLoading} contentClassName="space-y-3">
      <div className="flex items-center gap-2">
        <TrendIcon className={`size-5 ${trendColor}`} strokeWidth={2} />
        <span className={`text-2xl font-bold ${trendColor}`}>
          {data.net >= 0 ? "+" : ""}
          <SensitiveAmount>{formatCurrency(data.net)}</SensitiveAmount>
        </span>
      </div>

      {data.change !== 0 && (
        <p className={`text-xs ${data.change >= 0 ? "text-success" : "text-danger"}`}>
          {data.change >= 0 ? "+" : ""}
          {data.change}% {lang === "es" ? "vs mes anterior" : "vs last month"}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">{lang === "es" ? "Ingresos" : "Income"}</p>
          <p className="font-semibold text-success">
            +<SensitiveAmount>{formatCurrency(data.income)}</SensitiveAmount>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{lang === "es" ? "Gastos" : "Expenses"}</p>
          <p className="font-semibold text-danger">
            -<SensitiveAmount>{formatCurrency(data.expense)}</SensitiveAmount>
          </p>
        </div>
      </div>

      <div className="h-16">
        <Line
          data={{
            labels: data.sparkline.map((_, i) => String(i + 1)),
            datasets: [
              {
                data: data.sparkline,
                borderColor: sparkColor,
                backgroundColor: sparkColor + "15",
                borderWidth: 1.5,
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: true,
                tension: 0.3,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              tooltip: { ...tooltipConfig(), callbacks: { label: (ctx) => formatCurrency(ctx.parsed.y ?? 0) } },
              legend: { display: false },
            },
            scales: { x: { display: false }, y: { display: false } },
          }}
        />
      </div>
    </DashboardCard>
  );
}
