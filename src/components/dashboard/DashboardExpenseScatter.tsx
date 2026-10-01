"use client";

import { Scatter } from "react-chartjs-2";
import { DashboardCard, EmptyState } from "@/components/dashboard/DashboardCard";
import { useLang } from "@/hooks/useLang";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";
import { useMetricTransactions } from "@/hooks/useTransactions";
import { axisConfig, formatK, tooltipConfig, useChartTheme } from "@/lib/chartConfig";
import { toAppDate } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";

export default function DashboardExpenseScatter() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { colors } = useChartTheme();
  const nav = useMonthNavigation(lang);
  const { data: transactions, isLoading } = useMetricTransactions(nav.year, nav.month);

  const points = transactions
    .filter((tx) => tx.type === "expense")
    .map((tx) => ({ date: toAppDate(tx.date), y: tx.amount }))
    .filter(({ date }) => date.getFullYear() === nav.year && date.getMonth() === nav.month - 1)
    .map(({ date, y }) => ({ x: date.getDate(), y }));

  return (
    <DashboardCard
      title={t("dashboard.expenseByDay")}
      description={
        points.length > 0 &&
        (lang === "es" ? "Cada punto = un gasto (eje X: día, Y: importe)" : "Each point = one expense (X: day, Y: amount)")
      }
      nav={nav}
      loading={isLoading}
    >
      {points.length === 0 ? (
        <EmptyState>{t("home.noExpensesThisMonth")}</EmptyState>
      ) : (
        <div className="dashboard-chart w-full">
          <Scatter
            data={{
              datasets: [
                {
                  data: points,
                  backgroundColor: colors.danger + "B3",
                  pointRadius: points.map((p) => Math.max(3, Math.min(p.y / 50, 12))),
                  pointHoverRadius: 8,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: "nearest", intersect: true },
              plugins: {
                tooltip: {
                  ...tooltipConfig(),
                  callbacks: {
                    label: (ctx) => [
                      `${lang === "es" ? "Día" : "Day"}: ${ctx.parsed.x ?? 0}`,
                      `${lang === "es" ? "Importe" : "Amount"}: ${formatCurrency(ctx.parsed.y ?? 0)}`,
                    ],
                  },
                },
                legend: { display: false },
              },
              scales: {
                x: { ...axisConfig({ stepSize: 5 }), type: "linear", min: 1, max: new Date(nav.year, nav.month, 0).getDate() },
                y: axisConfig({ callback: formatK }),
              },
            }}
          />
        </div>
      )}
    </DashboardCard>
  );
}
