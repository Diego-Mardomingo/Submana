"use client";

import { useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
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

type Tx = { amount?: number; type?: string; account_id?: string | null };
type Account = { id: string; name: string; color?: string };

export default function DashboardExpenseByAccountDonut() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { containerRef, isTouch, tooltipKey } = useChartTooltipControl();
  const now = new Date();
  const { data: transactions = [], isLoading: txLoading } = useTransactions(now.getFullYear(), now.getMonth() + 1);
  const { data: accounts = [], isLoading: accLoading } = useAccounts();

  const accountMap = useMemo(() => {
    const m = new Map<string, Account>();
    for (const a of accounts as Account[]) m.set(a.id, a);
    return m;
  }, [accounts]);

  const chartData = useMemo(() => {
    const byAccount = new Map<string, number>();
    for (const tx of transactions as Tx[]) {
      if (tx.type !== "expense") continue;
      const accId = tx.account_id ?? "__unknown__";
      byAccount.set(accId, (byAccount.get(accId) ?? 0) + Number(tx.amount || 0));
    }
    const total = Array.from(byAccount.values()).reduce((s, v) => s + v, 0);
    if (total === 0) return [];
    return Array.from(byAccount.entries())
      .filter(([id]) => id !== "__unknown__")
      .map(([id, value]) => {
        const acc = accountMap.get(id);
        return {
          name: acc?.name ?? id,
          value: Math.round(value * 100) / 100,
          color: acc?.color ?? CHART_COLORS[0],
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [transactions, accountMap]);

  const totalExpense = chartData.reduce((s, d) => s + d.value, 0);
  const isLoading = txLoading || accLoading;

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.expenseByAccount")}
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
            {t("dashboard.expenseByAccount")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">{t("home.noExpensesThisMonth")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-muted-foreground">
          {t("dashboard.expenseByAccount")}
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
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                key={tooltipKey}
                trigger={isTouch ? "click" : "hover"}
                formatter={(value: number) => [
                  formatCurrency(value),
                  totalExpense > 0 ? `${((value / totalExpense) * 100).toFixed(1)}%` : "",
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
