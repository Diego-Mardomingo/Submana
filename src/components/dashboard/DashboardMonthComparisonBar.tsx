"use client";

import { useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Spinner } from "@/components/ui/spinner";

type Tx = { amount?: number; type?: string };

function useMonthlyTotals(year: number, month: number) {
  const { data: transactions = [], isLoading } = useTransactions(year, month);
  return useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of transactions as Tx[]) {
      const amt = Number(tx.amount) || 0;
      if (tx.type === "income") income += amt;
      else expense += amt;
    }
    return { income, expense, balance: income - expense, isLoading };
  }, [transactions, isLoading]);
}

export default function DashboardMonthComparisonBar() {
  const lang = useLang();
  const t = useTranslations(lang);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;

  const current = useMonthlyTotals(currentYear, currentMonth);
  const previous = useMonthlyTotals(prevYear, prevMonth);

  const chartData = useMemo(() => {
    const incomeLabel = lang === "es" ? "Ingresos" : "Income";
    const expenseLabel = lang === "es" ? "Gastos" : "Expense";
    const balanceLabel = lang === "es" ? "Balance" : "Balance";
    return [
      { metric: incomeLabel, current: current.income, previous: previous.income },
      { metric: expenseLabel, current: current.expense, previous: previous.expense },
      { metric: balanceLabel, current: current.balance, previous: previous.balance },
    ];
  }, [current, previous, lang]);

  const isLoading = current.isLoading || previous.isLoading;

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.monthComparison")}
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
          {t("dashboard.monthComparison")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="dashboard-chart w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="metric" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), ""]}
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--blanco)",
                }}
              />
              <Legend />
              <Bar dataKey="current" fill="var(--accent)" name={lang === "es" ? "Este mes" : "This month"} radius={[4, 4, 0, 0]} />
              <Bar dataKey="previous" fill="var(--muted-foreground)" name={lang === "es" ? "Mes anterior" : "Last month"} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
