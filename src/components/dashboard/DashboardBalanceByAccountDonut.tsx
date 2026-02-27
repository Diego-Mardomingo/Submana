"use client";

import { useMemo } from "react";
import { useAccounts } from "@/hooks/useAccounts";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { chartTooltipStyle } from "@/components/ui/chart-tooltip";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { useChartTooltipControl } from "@/hooks/useChartTooltipControl";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CHART_COLORS } from "./chartColors";
import { Spinner } from "@/components/ui/spinner";

type Account = { id: string; name: string; balance?: number; color?: string };

export default function DashboardBalanceByAccountDonut() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { containerRef, isTouch, tooltipKey } = useChartTooltipControl();
  const { data: accounts = [], isLoading } = useAccounts();

  const chartData = useMemo(() => {
    return (accounts as Account[])
      .filter((a) => Number(a.balance ?? 0) !== 0)
      .map((a) => ({
        name: a.name,
        value: Math.abs(Number(a.balance ?? 0)),
        color: a.color ?? CHART_COLORS[0],
      }));
  }, [accounts]);

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

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-muted-foreground">
          {t("dashboard.balanceByAccount")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="dashboard-chart-small w-full" ref={containerRef}>
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
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                key={tooltipKey}
                trigger={isTouch ? "click" : "hover"}
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
