"use client";

import { useMemo, useEffect, useState } from "react";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { formatCurrency } from "@/lib/format";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { Doughnut } from "react-chartjs-2";
import { Spinner } from "@/components/ui/spinner";
import { resolveChartPalette, tooltipConfig } from "@/lib/chartConfig";

type Sub = { id: string; service_name: string; cost?: number; frequency?: string; frequency_value?: number; end_date?: string | null };

function getMonthlyCost(sub: Sub): number {
  const cost = Number(sub.cost ?? 0);
  switch (sub.frequency) {
    case "weekly":
      return cost * (52 / 12);
    case "yearly":
      return cost / 12;
    default:
      return cost;
  }
}

function isActive(sub: Sub): boolean {
  if (sub.end_date) {
    return new Date(sub.end_date) >= new Date();
  }
  return true;
}

export default function DashboardSubscriptionsCard() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: subscriptions = [], isLoading } = useSubscriptions();
  const defaultPalette = ["#6366f1", "#10b981", "#3b82f6", "#f59e0b", "#14b8a6", "#ef4444", "#ec4899", "#8b5cf6", "#06b6d4", "#f97316"];
  const [colors, setColors] = useState<string[]>(defaultPalette);

  useEffect(() => {
    setColors(resolveChartPalette());
  }, []);

  const { chartData, total } = useMemo(() => {
    const active = (subscriptions as Sub[]).filter(isActive);
    const data = active.map((s) => ({
      name: s.service_name,
      value: Math.round(getMonthlyCost(s) * 100) / 100,
    }));
    const total = data.reduce((s, d) => s + d.value, 0);
    return { chartData: data, total };
  }, [subscriptions]);

  const doughnutData = useMemo(() => ({
    labels: chartData.map((d) => d.name),
    datasets: [{
      data: chartData.map((d) => d.value),
      backgroundColor: chartData.map((_, i) => colors[i % colors.length]),
      borderWidth: 0,
      hoverOffset: 6,
    }],
  }), [chartData, colors]);

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
            {t("dashboard.subscriptions")}
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
            {t("dashboard.subscriptions")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            {lang === "es" ? "Sin suscripciones activas" : "No active subscriptions"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-muted-foreground">
          {t("dashboard.subscriptions")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("sub.monthlyCost")}: <SensitiveAmount>{formatCurrency(total)}</SensitiveAmount>
        </p>
      </CardHeader>
      <CardContent>
        <div className="dashboard-chart-small w-full">
          <Doughnut data={doughnutData} options={doughnutOptions} />
        </div>
      </CardContent>
    </Card>
  );
}
