"use client";

import { useMemo } from "react";
import { useTransactionsRange } from "@/hooks/useTransactionsRange";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { chartTooltipStyle } from "@/components/ui/chart-tooltip";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { useChartTooltipControl } from "@/hooks/useChartTooltipControl";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Spinner } from "@/components/ui/spinner";

type Tx = { amount?: number; type?: string };

export default function DashboardBalanceTrendLine() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { containerRef, isTouch } = useChartTooltipControl();
  const { transactionsByMonth, monthLabels, isLoading } = useTransactionsRange();

  const chartData = useMemo(() => {
    let cumulative = 0;
    return monthLabels
      .map(({ key, label }) => {
        const txs = (transactionsByMonth[key] ?? []) as Tx[];
        let income = 0;
        let expense = 0;
        for (const tx of txs) {
          const amt = Number(tx.amount) || 0;
          if (tx.type === "income") income += amt;
          else expense += amt;
        }
        cumulative += income - expense;
        return { name: label, balance: Math.round(cumulative * 100) / 100 };
      });
  }, [transactionsByMonth, monthLabels]);

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.balanceTrend")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="size-6 text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-muted-foreground">
          {t("dashboard.balanceTrend")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{monthLabels.length} {lang === "es" ? "meses" : "months"}</p>
      </CardHeader>
      <CardContent>
        <div className="dashboard-chart-tall w-full" ref={containerRef}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                trigger={isTouch ? "click" : "hover"}
                formatter={(value: number) => [formatCurrency(value), ""]}
                {...chartTooltipStyle}
              />
              <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="balance" stroke="var(--accent)" strokeWidth={2} dot={{ fill: "var(--accent)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
