"use client";

import { useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { useChartTooltipControl } from "@/hooks/useChartTooltipControl";
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ZAxis } from "recharts";
import { Spinner } from "@/components/ui/spinner";

type Tx = { amount?: number; type?: string; date?: string };

export default function DashboardExpenseScatter() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { containerRef, isTouch } = useChartTooltipControl();
  const now = new Date();
  const { data: transactions = [], isLoading } = useTransactions(now.getFullYear(), now.getMonth() + 1);

  const chartData = useMemo(() => {
    const year = now.getFullYear();
    const month = now.getMonth();
    return (transactions as Tx[])
      .filter((tx) => tx.type === "expense" && tx.date)
      .map((tx) => {
        const d = new Date(tx.date!);
        if (d.getFullYear() !== year || d.getMonth() !== month) return null;
        const amount = Number(tx.amount) || 0;
        return { x: d.getDate(), y: amount, z: Math.min(amount / 50, 10) };
      })
      .filter((p): p is { x: number; y: number; z: number } => p !== null);
  }, [transactions]);

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.expenseByDay")}
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
            {t("dashboard.expenseByDay")}
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
          {t("dashboard.expenseByDay")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {lang === "es" ? "Cada punto = un gasto (eje X: día, Y: importe)" : "Each point = one expense (X: day, Y: amount)"}
        </p>
      </CardHeader>
      <CardContent>
        <div className="dashboard-chart w-full" ref={containerRef}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="x" type="number" name="day" domain={[1, 31]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis dataKey="y" type="number" name="amount" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <ZAxis dataKey="z" range={[50, 400]} />
              <Tooltip
                trigger={isTouch ? "click" : "hover"}
                cursor={{ strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload;
                  return (
                    <div
                      style={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        color: "var(--blanco)",
                        fontSize: "12px",
                      }}
                    >
                      <div>{lang === "es" ? "Día" : "Day"}: {p.x}</div>
                      <div>{lang === "es" ? "Importe" : "Amount"}: {formatCurrency(p.y)}</div>
                    </div>
                  );
                }}
              />
              <Scatter data={chartData} fill="var(--danger)" fillOpacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
