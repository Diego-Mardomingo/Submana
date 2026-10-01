"use client";

import { Bar } from "react-chartjs-2";
import { DashboardCard, EmptyState } from "@/components/dashboard/DashboardCard";
import { useAccounts } from "@/hooks/useAccounts";
import { useLang } from "@/hooks/useLang";
import { axisConfig, formatK, tooltipConfig, useChartTheme } from "@/lib/chartConfig";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";

type Account = { id: string; name: string; balance?: number; color?: string };

/** Horizontal bars with the balance of every non-empty account. */
export default function DashboardBalanceByAccountDonut() {
  const t = useTranslations(useLang());
  const { palette } = useChartTheme();
  const { data: accounts = [], isLoading } = useAccounts();

  const rows = (accounts as Account[]).filter((a) => Number(a.balance ?? 0) !== 0);
  const totalAbs = rows.reduce((sum, a) => sum + Math.abs(Number(a.balance)), 0);

  return (
    <DashboardCard title={t("dashboard.balanceByAccount")} loading={isLoading}>
      {rows.length === 0 ? (
        <EmptyState>{t("accounts.noAccounts")}</EmptyState>
      ) : (
        <div className="dashboard-chart w-full">
          <Bar
            data={{
              labels: rows.map((a) => a.name),
              datasets: [
                {
                  data: rows.map((a) => Number(a.balance)),
                  backgroundColor: rows.map((a, i) => a.color ?? palette[i % palette.length]),
                  borderRadius: 8,
                  borderSkipped: false,
                  barThickness: 14,
                  maxBarThickness: 18,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              indexAxis: "y",
              interaction: { mode: "index", intersect: false },
              plugins: {
                tooltip: {
                  ...tooltipConfig(),
                  callbacks: {
                    label: (ctx) => {
                      const v = ctx.parsed.x ?? 0;
                      return `${ctx.label}: ${formatCurrency(v)} (${totalAbs > 0 ? ((Math.abs(v) / totalAbs) * 100).toFixed(1) : "0"}%)`;
                    },
                  },
                },
                legend: { display: false },
              },
              scales: { x: axisConfig({ callback: formatK }), y: axisConfig({ font: { size: 11 } }) },
            }}
          />
        </div>
      )}
    </DashboardCard>
  );
}
