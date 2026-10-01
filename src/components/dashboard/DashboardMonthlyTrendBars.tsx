"use client";

import { useState } from "react";
import { Bar } from "react-chartjs-2";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { MonthRangePicker } from "@/components/dashboard/MonthRangePicker";
import { useCategories } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { useTransactionsRange, type DateRange } from "@/hooks/useTransactions";
import { axisConfig, formatK, tooltipConfig, useChartTheme } from "@/lib/chartConfig";
import { shiftMonth } from "@/lib/date";
import { formatCurrency, monthKeyLabel } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { metricTransactions, sumByType } from "@/lib/metricsFilters";

/** Last 12 months, current one included. */
function lastYearRange(): DateRange {
  const now = new Date();
  const start = shiftMonth(now.getFullYear(), now.getMonth() + 1, -11);
  return { startYear: start.year, startMonth: start.month, endYear: now.getFullYear(), endMonth: now.getMonth() + 1 };
}

export default function DashboardMonthlyTrendBars() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { colors } = useChartTheme();
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const range = customRange ?? lastYearRange();
  const { byMonth, keys, availableRange, isLoading } = useTransactionsRange(undefined, range);
  const { data: categories } = useCategories();

  const totals = keys.map((key) => sumByType(metricTransactions(byMonth.get(key) ?? [], categories)));

  return (
    <DashboardCard
      title={t("dashboard.incomeVsExpense")}
      action={
        !isLoading && (
          <MonthRangePicker
            shown={range}
            available={availableRange}
            isCustom={!!customRange}
            onChange={setCustomRange}
            monthCount={keys.length}
          />
        )
      }
      loading={isLoading}
    >
      <div className="dashboard-chart-tall w-full">
        <Bar
          data={{
            labels: keys.map((key) => monthKeyLabel(key, lang)),
            datasets: [
              { label: lang === "es" ? "Ingresos" : "Income", data: totals.map((m) => m.income), backgroundColor: colors.success, borderRadius: 4 },
              { label: lang === "es" ? "Gastos" : "Expense", data: totals.map((m) => m.expense), backgroundColor: colors.danger, borderRadius: 4 },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              tooltip: {
                ...tooltipConfig(),
                callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}` },
              },
              legend: { labels: { font: { size: 12 }, usePointStyle: true, pointStyle: "rectRounded" } },
            },
            scales: { x: axisConfig(), y: axisConfig({ callback: formatK }) },
          }}
        />
      </div>
    </DashboardCard>
  );
}
