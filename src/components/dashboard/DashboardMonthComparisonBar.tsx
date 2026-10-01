"use client";

import { Bar } from "react-chartjs-2";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { useLang } from "@/hooks/useLang";
import { useMetricTransactions } from "@/hooks/useTransactions";
import { axisConfig, formatK, tooltipConfig, useChartTheme } from "@/lib/chartConfig";
import { appNow, shiftMonth } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { sumByType } from "@/lib/metricsFilters";

function useMonthTotals(year: number, month: number) {
  const { data, isLoading } = useMetricTransactions(year, month);
  const { income, expense } = sumByType(data);
  return { values: [income, expense, income - expense], isLoading };
}

export default function DashboardMonthComparisonBar() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { colors } = useChartTheme();
  const now = appNow();
  const prev = shiftMonth(now.getFullYear(), now.getMonth() + 1, -1);
  const current = useMonthTotals(now.getFullYear(), now.getMonth() + 1);
  const previous = useMonthTotals(prev.year, prev.month);

  return (
    <DashboardCard title={t("dashboard.monthComparison")} loading={current.isLoading || previous.isLoading}>
      <div className="dashboard-chart w-full">
        <Bar
          data={{
            labels: [lang === "es" ? "Ingresos" : "Income", lang === "es" ? "Gastos" : "Expense", "Balance"],
            datasets: [
              {
                label: lang === "es" ? "Mes anterior" : "Last month",
                data: previous.values,
                backgroundColor: colors.accent + "50",
                borderRadius: 4,
              },
              {
                label: lang === "es" ? "Este mes" : "This month",
                data: current.values,
                backgroundColor: colors.success,
                borderRadius: 4,
              },
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
              legend: { labels: { font: { size: 11 }, usePointStyle: true, pointStyle: "rectRounded" } },
            },
            scales: { x: axisConfig({ font: { size: 11 } }), y: axisConfig({ callback: formatK }) },
          }}
        />
      </div>
    </DashboardCard>
  );
}
