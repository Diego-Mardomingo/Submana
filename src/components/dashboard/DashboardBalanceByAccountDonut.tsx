"use client";

import { useMemo, useEffect, useState } from "react";
import { useAccounts } from "@/hooks/useAccounts";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { Doughnut } from "react-chartjs-2";
import { Spinner } from "@/components/ui/spinner";
import { tooltipConfig, resolveChartPalette } from "@/lib/chartConfig";

type Account = { id: string; name: string; balance?: number; color?: string };

export default function DashboardBalanceByAccountDonut() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: accounts = [], isLoading } = useAccounts();
  const defaultPalette = ["#6366f1", "#10b981", "#3b82f6", "#f59e0b", "#14b8a6", "#ef4444", "#ec4899", "#8b5cf6", "#06b6d4", "#f97316"];
  const [colors, setColors] = useState<string[]>(defaultPalette);

  useEffect(() => {
    setColors(resolveChartPalette());
  }, []);

  const chartData = useMemo(() => {
    return (accounts as Account[])
      .filter((a) => Number(a.balance ?? 0) !== 0)
      .map((a, i) => ({
        name: a.name,
        value: Math.abs(Number(a.balance ?? 0)),
        color: a.color ?? colors[i % colors.length] ?? colors[0],
      }));
  }, [accounts, colors]);

  const total = chartData.reduce((s, d) => s + d.value, 0);

  const doughnutData = useMemo(() => ({
    labels: chartData.map((d) => d.name),
    datasets: [{
      data: chartData.map((d) => d.value),
      backgroundColor: chartData.map((d) => d.color),
      borderWidth: 0,
      hoverOffset: 6,
    }],
  }), [chartData]);

  const doughnutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: "50%",
    plugins: {
      tooltip: {
        ...tooltipConfig(),
        callbacks: {
          label: (ctx: { label?: string; parsed: number }) => {
            const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : "0";
            return `${ctx.label}: ${formatCurrency(ctx.parsed)} (${pct}%)`;
          },
        },
      },
      legend: {
        labels: { font: { size: 11 }, boxWidth: 8, usePointStyle: true, pointStyle: "circle" },
      },
    },
  }), [total]);

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.balanceByAccount")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="size-6 text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.balanceByAccount")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">{t("accounts.noAccounts")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-muted-foreground">
          {t("dashboard.balanceByAccount")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="dashboard-chart-small w-full">
          <Doughnut data={doughnutData} options={doughnutOptions} />
        </div>
      </CardContent>
    </Card>
  );
}
