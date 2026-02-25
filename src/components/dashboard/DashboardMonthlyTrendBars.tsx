"use client";

import { useMemo } from "react";
import { useTransactionsRange } from "@/hooks/useTransactionsRange";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Spinner } from "@/components/ui/spinner";

type Tx = { amount?: number; type?: string };

export default function DashboardMonthlyTrendBars() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { transactionsByMonth, monthLabels, isLoading } = useTransactionsRange();

  const chartData = useMemo(() => {
    return monthLabels.map(({ key, label }) => {
      const txs = (transactionsByMonth[key] ?? []) as Tx[];
      let income = 0;
      let expense = 0;
      for (const tx of txs) {
        const amt = Number(tx.amount) || 0;
        if (tx.type === "income") income += amt;
        else expense += amt;
      }
      return { name: label, income, expense };
    });
  }, [transactionsByMonth, monthLabels]);

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.incomeVsExpense")}
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
          {t("dashboard.incomeVsExpense")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{monthLabels.length} {lang === "es" ? "meses" : "months"}</p>
      </CardHeader>
      <CardContent>
        <div className="dashboard-chart-tall w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), ""]}
                labelFormatter={(label) => label}
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--blanco)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="income" fill="var(--success)" name={lang === "es" ? "Ingresos" : "Income"} radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" fill="var(--danger)" name={lang === "es" ? "Gastos" : "Expense"} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
