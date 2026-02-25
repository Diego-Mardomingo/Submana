"use client";

import { useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "./chartColors";
import { Spinner } from "@/components/ui/spinner";

type Tx = { amount?: number; type?: string; date?: string };

const WEEKDAY_KEYS = ["calendar.monday", "calendar.tuesday", "calendar.wednesday", "calendar.thursday", "calendar.friday", "calendar.saturday", "calendar.sunday"];

export default function DashboardDailyExpenseBars() {
  const lang = useLang();
  const t = useTranslations(lang);
  const now = new Date();
  const { data: transactions = [], isLoading } = useTransactions(now.getFullYear(), now.getMonth() + 1);

  const { chartData } = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const byDay = new Map<number, number>();
    for (let i = 0; i < 7; i++) byDay.set(i, 0);

    for (const tx of transactions as Tx[]) {
      if (tx.type !== "expense") continue;
      const d = tx.date ? new Date(tx.date) : null;
      if (!d || d < weekStart || d > weekEnd) continue;
      const dayIndex = Math.floor((d.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
      byDay.set(dayIndex, (byDay.get(dayIndex) ?? 0) + Number(tx.amount || 0));
    }

    const data = Array.from({ length: 7 }, (_, i) => ({
      name: t(WEEKDAY_KEYS[i] as "calendar.monday"),
      value: Math.round((byDay.get(i) ?? 0) * 100) / 100,
    }));

    return { chartData: data };
  }, [transactions, t]);

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.dailyExpense")}
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
          {t("dashboard.dailyExpense")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="dashboard-chart w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), ""]}
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--blanco)",
                }}
              />
              <Bar dataKey="value" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
