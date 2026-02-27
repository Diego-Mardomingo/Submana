"use client";

import { useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { chartTooltipStyle } from "@/components/ui/chart-tooltip";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { useChartTooltipControl } from "@/hooks/useChartTooltipControl";
import { RadialBarChart, RadialBar, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Spinner } from "@/components/ui/spinner";

type Tx = { amount?: number; type?: string };

export default function DashboardSavingsRateRadial() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { containerRef, isTouch, tooltipKey } = useChartTooltipControl();
  const now = new Date();
  const { data: transactions = [], isLoading } = useTransactions(now.getFullYear(), now.getMonth() + 1);

  const { rate, income, expense, balance } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of transactions as Tx[]) {
      const amt = Number(tx.amount) || 0;
      if (tx.type === "income") income += amt;
      else expense += amt;
    }
    const balance = income - expense;
    const rate = income > 0 ? Math.min(100, Math.max(-100, (balance / income) * 100)) : 0;
    return { rate, income, expense, balance };
  }, [transactions]);

  const chartValue = rate >= 0 ? Math.min(100, rate) : 0;
  const chartData = [{ name: "savings", value: chartValue, fill: rate >= 0 ? "var(--success)" : "var(--danger)" }];

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.savingsRate")}
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
          {t("dashboard.savingsRate")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="dashboard-chart w-full" ref={containerRef}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="90%"
              data={chartData}
              startAngle={180}
              endAngle={0}
            >
              <RadialBar background dataKey="value" cornerRadius={8} />
              <Legend
                content={() => (
                  <div className="flex flex-col items-center justify-center gap-1 text-center">
                    <span
                      className="text-2xl font-bold"
                      style={{ color: rate >= 0 ? "var(--success)" : "var(--danger)" }}
                    >
                      {rate >= 0 ? "+" : ""}
                      {rate.toFixed(1)}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {income > 0
                        ? lang === "es"
                          ? `Balance: ${formatCurrency(balance)}`
                          : `Balance: ${formatCurrency(balance)}`
                        : lang === "es"
                          ? "Sin ingresos"
                          : "No income"}
                    </span>
                  </div>
                )}
              />
              <Tooltip
                key={tooltipKey}
                trigger={isTouch ? "click" : "hover"}
                formatter={() => [formatCurrency(balance), ""]}
                {...chartTooltipStyle}
              />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
