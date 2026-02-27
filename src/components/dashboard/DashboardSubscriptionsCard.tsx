"use client";

import { useMemo } from "react";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { chartTooltipStyle } from "@/components/ui/chart-tooltip";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CHART_COLORS } from "./chartColors";
import { Spinner } from "@/components/ui/spinner";

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

  const { chartData, total } = useMemo(() => {
    const active = (subscriptions as Sub[]).filter(isActive);
    const data = active.map((s, i) => ({
      name: s.service_name,
      value: Math.round(getMonthlyCost(s) * 100) / 100,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
    const total = data.reduce((s, d) => s + d.value, 0);
    return { chartData: data, total };
  }, [subscriptions]);

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
        <p className="text-xs text-muted-foreground">{t("sub.monthlyCost")}: {formatCurrency(total)}</p>
      </CardHeader>
      <CardContent>
        <div className="dashboard-chart-small w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="50%"
                outerRadius="80%"
                paddingAngle={2}
                stroke="transparent"
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [
                  formatCurrency(value),
                  total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "",
                ]}
                {...chartTooltipStyle}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
