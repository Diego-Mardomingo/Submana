"use client";

import { useMemo, useState, useEffect } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { Bar } from "react-chartjs-2";
import { Spinner } from "@/components/ui/spinner";
import { tooltipConfig, axisConfig, formatK, getChartColors } from "@/lib/chartConfig";
import { detectTransferIds } from "@/lib/transferDetection";
import { filterForMetrics } from "@/lib/metricsFilters";
import { useCategories } from "@/hooks/useCategories";

type Tx = { id: string; amount?: number; type?: string; date?: string; account_id?: string; category_id?: string | null; subcategory_id?: string | null };

function useMonthlyTotals(year: number, month: number) {
  const { data: transactions = [], isLoading } = useTransactions(year, month);
  const { data: categoriesData } = useCategories();
  return useMemo(() => {
    const ctx = {
      defaultCategories: categoriesData?.defaultCategories ?? [],
      userCategories: categoriesData?.userCategories ?? [],
    };
    const txList = transactions as Tx[];
    const transferIds = detectTransferIds(txList.map((tx) => ({ id: tx.id, amount: Number(tx.amount) || 0, type: tx.type || "", date: tx.date || "", account_id: tx.account_id })));
    const forMetrics = filterForMetrics(
      txList.filter((tx) => !transferIds.has(tx.id)),
      ctx
    );
    let income = 0;
    let expense = 0;
    for (const tx of forMetrics) {
      const amt = Number(tx.amount) || 0;
      if (tx.type === "income") income += amt;
      else expense += amt;
    }
    return { income, expense, balance: income - expense, isLoading };
  }, [transactions, categoriesData, isLoading]);
}

export default function DashboardMonthComparisonBar() {
  const lang = useLang();
  const t = useTranslations(lang);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;

  const [chartColors, setChartColors] = useState({ success: "#10b981", accent: "#6366f1" });
  useEffect(() => {
    const c = getChartColors();
    setChartColors({
      success: c.success || "#10b981",
      accent: c.accent || "#6366f1",
    });
  }, []);

  const current = useMonthlyTotals(currentYear, currentMonth);
  const previous = useMonthlyTotals(prevYear, prevMonth);

  const chartLabels = useMemo(() => {
    const incomeLabel = lang === "es" ? "Ingresos" : "Income";
    const expenseLabel = lang === "es" ? "Gastos" : "Expense";
    const balanceLabel = "Balance";
    return [incomeLabel, expenseLabel, balanceLabel];
  }, [lang]);

  const barData = useMemo(() => ({
    labels: chartLabels,
    datasets: [
      {
        label: lang === "es" ? "Mes anterior" : "Last month",
        data: [previous.income, previous.expense, previous.balance],
        backgroundColor: chartColors.accent + "50",
        borderRadius: 4,
      },
      {
        label: lang === "es" ? "Este mes" : "This month",
        data: [current.income, current.expense, current.balance],
        backgroundColor: chartColors.success,
        borderRadius: 4,
      },
    ],
  }), [chartLabels, current, previous, lang, chartColors]);

  const barOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      tooltip: {
        ...tooltipConfig(),
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
            `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}`,
        },
      },
      legend: {
        labels: { font: { size: 11 }, usePointStyle: true, pointStyle: "rectRounded" },
      },
    },
    scales: {
      x: { ...axisConfig(), ticks: { ...axisConfig().ticks, font: { size: 11 } } },
      y: {
        ...axisConfig(),
        ticks: { ...axisConfig().ticks, callback: formatK },
      },
    },
  }), []);

  const isLoading = current.isLoading || previous.isLoading;

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.monthComparison")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="size-6 text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-muted-foreground">
          {t("dashboard.monthComparison")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="dashboard-chart w-full">
          <Bar data={barData} options={barOptions} />
        </div>
      </CardContent>
    </Card>
  );
}
