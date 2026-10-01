"use client";

import { Doughnut } from "react-chartjs-2";
import { DashboardCard, EmptyState } from "@/components/dashboard/DashboardCard";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { useLang } from "@/hooks/useLang";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { tooltipConfig, useChartTheme } from "@/lib/chartConfig";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { isSubscriptionActive, monthlyCost } from "@/lib/subscriptions";

export default function DashboardSubscriptionsCard() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { palette } = useChartTheme();
  const { data: subscriptions = [], isLoading } = useSubscriptions();

  const active = subscriptions.filter(isSubscriptionActive);
  const values = active.map((s) => Math.round(monthlyCost(s) * 100) / 100);
  const total = values.reduce((sum, v) => sum + v, 0);

  return (
    <DashboardCard
      title={t("dashboard.subscriptions")}
      description={
        active.length > 0 && (
          <>
            {t("sub.monthlyCost")}: <SensitiveAmount>{formatCurrency(total)}</SensitiveAmount>
          </>
        )
      }
      loading={isLoading}
    >
      {active.length === 0 ? (
        <EmptyState>{lang === "es" ? "Sin suscripciones activas" : "No active subscriptions"}</EmptyState>
      ) : (
        <div className="dashboard-chart-small w-full">
          <Doughnut
            data={{
              labels: active.map((s) => s.service_name),
              datasets: [
                { data: values, backgroundColor: values.map((_, i) => palette[i % palette.length]), borderWidth: 0, hoverOffset: 6 },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              cutout: "50%",
              plugins: {
                tooltip: {
                  ...tooltipConfig(),
                  callbacks: {
                    label: (ctx) =>
                      `${ctx.label}: ${formatCurrency(ctx.parsed)} (${total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : "0"}%)`,
                  },
                },
                legend: { labels: { font: { size: 11 }, boxWidth: 8, usePointStyle: true, pointStyle: "circle" } },
              },
            }}
          />
        </div>
      )}
    </DashboardCard>
  );
}
