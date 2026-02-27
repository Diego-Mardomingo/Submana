"use client";

import { useMemo, useState } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { chartTooltipStyle } from "@/components/ui/chart-tooltip";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useChartTooltipControl } from "@/hooks/useChartTooltipControl";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Spinner } from "@/components/ui/spinner";
import { ChartMobileHint } from "./ChartMobileHint";

type Tx = { amount?: number; type?: string; date?: string };
type Period = "week" | "month" | "year";

const WEEKDAY_KEYS = ["calendar.monday", "calendar.tuesday", "calendar.wednesday", "calendar.thursday", "calendar.friday", "calendar.saturday", "calendar.sunday"];
const MONTH_KEYS = ["calendar.months.january", "calendar.months.february", "calendar.months.march", "calendar.months.april", "calendar.months.may", "calendar.months.june", "calendar.months.july", "calendar.months.august", "calendar.months.september", "calendar.months.october", "calendar.months.november", "calendar.months.december"];

export default function DashboardDailyExpenseBars() {
  const lang = useLang();
  const t = useTranslations(lang);
  const [period, setPeriod] = useState<Period>("month");
  const isMobile = useMediaQuery("(max-width: 768px)");
  const now = new Date();
  
  // Control de tooltip para evitar activación durante scroll
  const { containerRef: chartContainerRef, isTouch, tooltipKey } = useChartTooltipControl();
  
  // Para año necesitamos transacciones de todo el año
  const { data: currentMonthTx = [], isLoading: loadingCurrent } = useTransactions(
    now.getFullYear(),
    period === "year" ? undefined : now.getMonth() + 1
  );
  
  // Para año, cargamos todas las transacciones del año
  const { data: yearTx = [], isLoading: loadingYear } = useTransactions(
    now.getFullYear(),
    undefined
  );
  
  const transactions = period === "year" ? yearTx : currentMonthTx;
  const isLoading = period === "year" ? loadingYear : loadingCurrent;

  const { chartData, title } = useMemo(() => {
    const today = new Date();
    
    if (period === "week") {
      // Semana actual: Lun-Dom
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

      return { chartData: data, title: t("dashboard.expenseWeekly") };
    }
    
    if (period === "month") {
      // Mes actual: días 1-31
      const year = today.getFullYear();
      const month = today.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      const byDay = new Map<number, number>();
      for (let i = 1; i <= daysInMonth; i++) byDay.set(i, 0);

      for (const tx of transactions as Tx[]) {
        if (tx.type !== "expense") continue;
        const d = tx.date ? new Date(tx.date) : null;
        if (!d || d.getMonth() !== month || d.getFullYear() !== year) continue;
        const day = d.getDate();
        byDay.set(day, (byDay.get(day) ?? 0) + Number(tx.amount || 0));
      }

      const data = Array.from({ length: daysInMonth }, (_, i) => ({
        name: String(i + 1),
        value: Math.round((byDay.get(i + 1) ?? 0) * 100) / 100,
      }));

      return { chartData: data, title: t("dashboard.expenseMonthly") };
    }
    
    // Año: meses Ene-Dic
    const year = today.getFullYear();
    const byMonth = new Map<number, number>();
    for (let i = 0; i < 12; i++) byMonth.set(i, 0);

    for (const tx of transactions as Tx[]) {
      if (tx.type !== "expense") continue;
      const d = tx.date ? new Date(tx.date) : null;
      if (!d || d.getFullYear() !== year) continue;
      const monthIdx = d.getMonth();
      byMonth.set(monthIdx, (byMonth.get(monthIdx) ?? 0) + Number(tx.amount || 0));
    }

    const data = Array.from({ length: 12 }, (_, i) => ({
      name: t(MONTH_KEYS[i] as "calendar.months.january").slice(0, 3),
      value: Math.round((byMonth.get(i) ?? 0) * 100) / 100,
    }));

    return { chartData: data, title: t("dashboard.expenseYearly") };
  }, [transactions, t, period]);

  const periodButtons = (
    <CardAction>
      <div className="flex gap-1">
        {(["week", "month", "year"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
              period === p
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t(`dashboard.period${p.charAt(0).toUpperCase() + p.slice(1)}` as "dashboard.periodWeek")}
          </button>
        ))}
      </div>
    </CardAction>
  );

  // Calcular intervalo del eje X según periodo y tamaño de pantalla
  const getXAxisInterval = () => {
    if (period === "week") return 0;
    if (period === "month") return isMobile ? 4 : 2; // Cada 5 días en móvil, cada 3 en desktop
    if (period === "year") return isMobile ? 1 : 0; // Cada 2 meses en móvil
    return 0;
  };

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {title}
          </CardTitle>
          {periodButtons}
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
          {title}
        </CardTitle>
        {periodButtons}
      </CardHeader>
      <CardContent>
        <div className="dashboard-chart w-full" ref={chartContainerRef}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 4, left: -15, bottom: 0 }}>
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: period === "month" ? 8 : 10 }} 
                stroke="var(--muted-foreground)"
                interval={getXAxisInterval()}
              />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={45} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
              <Tooltip
                key={tooltipKey}
                trigger={isTouch ? "click" : "hover"}
                formatter={(value: number) => [formatCurrency(value), ""]}
                {...chartTooltipStyle}
              />
              <Bar dataKey="value" fill="var(--danger)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {isTouch && <ChartMobileHint type="tap" />}
      </CardContent>
    </Card>
  );
}
