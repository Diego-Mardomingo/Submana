"use client";

import { useState } from "react";
import { Doughnut } from "react-chartjs-2";
import { DashboardCard, EmptyState } from "@/components/dashboard/DashboardCard";
import { useCategoryLookup } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";
import { useMetricTransactions } from "@/hooks/useTransactions";
import { tooltipConfig, useChartTheme } from "@/lib/chartConfig";
import { toAppDate } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import styles from "./HomeCategoryDonutCard.module.css";

type Period = "month" | "year";

export default function HomeCategoryDonutCard() {
  const lang = useLang();
  const t = useTranslations(lang);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { palette } = useChartTheme();
  const [period, setPeriod] = useState<Period>("month");
  const nav = useMonthNavigation(lang, period);
  const month = useMetricTransactions(nav.year, nav.month);
  const all = useMetricTransactions();
  const { data, isLoading, isFetching } = period === "month" ? month : all;
  const categories = useCategoryLookup();

  const byCategory = new Map<string, number>();
  for (const tx of data) {
    if (tx.type !== "expense" || (period === "year" && toAppDate(tx.date).getFullYear() !== nav.year)) continue;
    const id = categories.rootOf(tx) ?? "";
    byCategory.set(id, (byCategory.get(id) ?? 0) + tx.amount);
  }
  const slices = [...byCategory]
    .map(([id, value]) => ({ id, value: Math.round(value * 100) / 100, name: id ? (categories.name.get(id) ?? id) : t("home.uncategorized") }))
    .sort((a, b) => b.value - a.value);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  // Stable colour per category across periods: index among all root categories (uncategorised last).
  const colorOrder = [...categories.name.keys()].filter((id) => !categories.parent.has(id)).sort();
  const colorOf = (id: string) => palette[(id ? colorOrder.indexOf(id) : colorOrder.length) % palette.length];

  const periodButtons = (
    <div className="flex gap-1">
      {(["month", "year"] as const).map((p) => (
        <button
          key={p}
          onClick={() => setPeriod(p)}
          className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
            period === p ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {t(p === "month" ? "dashboard.periodMonth" : "dashboard.periodYear")}
        </button>
      ))}
    </div>
  );

  return (
    <DashboardCard
      className="home-card"
      title={t("home.expensesByCategory")}
      action={periodButtons}
      nav={nav}
      loading={isLoading || categories.isLoading}
      refreshing={isFetching}
    >
      {slices.length === 0 ? (
        <EmptyState>{t(period === "year" ? "home.noExpensesThisYear" : "home.noExpensesThisMonth")}</EmptyState>
      ) : (
        <div className={styles.chartWrapper}>
          <Doughnut
            data={{
              labels: slices.map((s) => `${s.name} (${total > 0 ? ((s.value / total) * 100).toFixed(0) : "0"}%)`),
              datasets: [{ data: slices.map((s) => s.value), backgroundColor: slices.map((s) => colorOf(s.id)), borderWidth: 0, hoverOffset: 6 }],
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
                      `${slices[ctx.dataIndex]?.name}: ${formatCurrency(ctx.parsed)} (${total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : "0"}%)`,
                  },
                },
                legend: {
                  position: "right",
                  labels: { boxWidth: isMobile ? 6 : 8, usePointStyle: true, pointStyle: "circle", font: { size: isMobile ? 9 : 11 } },
                },
              },
            }}
          />
        </div>
      )}
    </DashboardCard>
  );
}
