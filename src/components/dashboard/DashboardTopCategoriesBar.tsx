"use client";

import { Doughnut } from "react-chartjs-2";
import { DashboardCard, EmptyState } from "@/components/dashboard/DashboardCard";
import { useCategoryLookup } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { useMetricTransactions } from "@/hooks/useTransactions";
import { tooltipConfig, useChartTheme } from "@/lib/chartConfig";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";

export default function DashboardTopCategoriesBar() {
  const t = useTranslations(useLang());
  const { palette } = useChartTheme();
  const now = new Date();
  const { data: transactions, isLoading } = useMetricTransactions(now.getFullYear(), now.getMonth() + 1);
  const categories = useCategoryLookup();

  const byCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    const id = categories.rootOf(tx) ?? "";
    byCategory.set(id, (byCategory.get(id) ?? 0) + tx.amount);
  }
  const top = [...byCategory]
    .map(([id, value]) => ({ name: id ? (categories.name.get(id) ?? id) : t("home.uncategorized"), value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const total = top.reduce((sum, d) => sum + d.value, 0);

  return (
    <DashboardCard title={t("dashboard.topCategories")} loading={isLoading || categories.isLoading}>
      {top.length === 0 ? (
        <EmptyState>{t("home.noExpensesThisMonth")}</EmptyState>
      ) : (
        <div className="dashboard-chart-small w-full">
          <Doughnut
            data={{
              labels: top.map((d) => d.name),
              datasets: [{ data: top.map((d) => d.value), backgroundColor: palette, borderWidth: 0, hoverOffset: 6 }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              cutout: "55%",
              plugins: {
                tooltip: {
                  ...tooltipConfig(),
                  callbacks: {
                    label: (ctx) =>
                      `${ctx.label}: ${formatCurrency(ctx.parsed)} (${total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : "0"}%)`,
                  },
                },
                legend: {
                  position: "right",
                  labels: { font: { size: 11 }, boxWidth: 8, usePointStyle: true, pointStyle: "circle" },
                },
              },
            }}
          />
        </div>
      )}
    </DashboardCard>
  );
}
