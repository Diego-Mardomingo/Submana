"use client";

import { useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { chartTooltipStyle } from "@/components/ui/chart-tooltip";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { useChartTooltipControl } from "@/hooks/useChartTooltipControl";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Spinner } from "@/components/ui/spinner";

type Tx = { amount?: number; type?: string; date?: string };

export default function DashboardCashFlowArea() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { containerRef, isTouch, tooltipKey } = useChartTooltipControl();
  const now = new Date();
  const { data: transactions = [], isLoading } = useTransactions(now.getFullYear(), now.getMonth() + 1);

  const chartData = useMemo(() => {
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const byDay = new Map<number, { income: number; expense: number }>();
    for (let d = 1; d <= daysInMonth; d++) byDay.set(d, { income: 0, expense: 0 });

    for (const tx of transactions as Tx[]) {
      const d = tx.date ? new Date(tx.date) : null;
      if (!d || d.getFullYear() !== year || d.getMonth() !== month) continue;
      const day = d.getDate();
      const entry = byDay.get(day)!;
      const amt = Number(tx.amount) || 0;
      if (tx.type === "income") entry.income += amt;
      else entry.expense += amt;
    }

    let cumulative = 0;
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const { income, expense } = byDay.get(d)!;
      cumulative += income - expense;
      return { day: d, flow: Math.round(cumulative * 100) / 100 };
    });
  }, [transactions]);

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.cashFlow")}
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
          {t("dashboard.cashFlow")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="dashboard-chart-tall w-full" ref={containerRef}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cashFlowGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                key={tooltipKey}
                trigger={isTouch ? "click" : "hover"}
                formatter={(value: number) => [formatCurrency(value), ""]}
                labelFormatter={(label) => `${t("common.date")}: ${label}`}
                {...chartTooltipStyle}
              />
              <Area type="monotone" dataKey="flow" stroke="var(--accent)" fill="url(#cashFlowGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
