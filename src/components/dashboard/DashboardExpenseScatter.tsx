"use client";

import { useMemo, useEffect, useRef, useCallback } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Scatter } from "react-chartjs-2";
import { Spinner } from "@/components/ui/spinner";
import { tooltipConfig, axisConfig, formatK } from "@/lib/chartConfig";
import { detectTransferIds } from "@/lib/transferDetection";
import styles from "./DashboardMonthNav.module.css";

type Tx = { id: string; amount?: number; type?: string; date?: string; account_id?: string };

export default function DashboardExpenseScatter() {
  const lang = useLang();
  const t = useTranslations(lang);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const nav = useMonthNavigation(lang);
  const { data: transactions = [], isLoading } = useTransactions(nav.year, nav.month);
  const dangerRef = useRef("");

  const cardRefCallback = useCallback(
    (node: HTMLDivElement | null) => { nav.setSwipeElement(node); },
    [nav.setSwipeElement]
  );

  useEffect(() => {
    dangerRef.current = getComputedStyle(document.documentElement).getPropertyValue("--danger").trim();
  }, []);

  const daysInMonth = new Date(nav.year, nav.month, 0).getDate();

  const chartData = useMemo(() => {
    const year = nav.year;
    const month = nav.month - 1;
    const txList = transactions as Tx[];
    const transferIds = detectTransferIds(txList.map((tx) => ({ id: tx.id, amount: Number(tx.amount) || 0, type: tx.type || "", date: tx.date || "", account_id: tx.account_id })));
    return txList
      .filter((tx) => tx.type === "expense" && !transferIds.has(tx.id) && tx.date)
      .map((tx) => {
        const d = new Date(tx.date!);
        if (d.getFullYear() !== year || d.getMonth() !== month) return null;
        const amount = Number(tx.amount) || 0;
        return { x: d.getDate(), y: amount };
      })
      .filter((p): p is { x: number; y: number } => p !== null);
  }, [transactions, nav.year, nav.month]);

  const scatterData = useMemo(() => ({
    datasets: [{
      data: chartData,
      backgroundColor: (dangerRef.current || "#ef4444") + "B3",
      pointRadius: chartData.map((p) => Math.max(3, Math.min(p.y / 50, 12))),
      pointHoverRadius: 8,
    }],
  }), [chartData]);

  const scatterOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "nearest" as const, intersect: true },
    plugins: {
      tooltip: {
        ...tooltipConfig(),
        callbacks: {
          label: (ctx: { parsed: { x: number | null; y: number | null } }) => {
            const dayLabel = lang === "es" ? "Día" : "Day";
            const amtLabel = lang === "es" ? "Importe" : "Amount";
            return [`${dayLabel}: ${ctx.parsed.x ?? 0}`, `${amtLabel}: ${formatCurrency(ctx.parsed.y ?? 0)}`];
          },
        },
      },
      legend: { display: false },
    },
    scales: {
      x: {
        ...axisConfig(),
        type: "linear" as const,
        min: 1,
        max: daysInMonth,
        title: { display: false },
        ticks: { ...axisConfig().ticks, stepSize: 5 },
      },
      y: {
        ...axisConfig(),
        ticks: { ...axisConfig().ticks, callback: formatK },
      },
    },
  }), [lang, daysInMonth]);

  const monthNav = (
    <div className={styles.monthNav}>
      {!isMobile && (
        <Button variant="ghost" size="icon" onClick={nav.goToPrevMonth} className={styles.navButton} aria-label="Previous month">
          <ChevronLeft className="size-4" strokeWidth={1.5} />
        </Button>
      )}
      <button type="button" onClick={nav.goToCurrentMonth} className={styles.monthLabel} title={nav.isCurrentMonth ? undefined : t("calendar.today")}>
        <span>{nav.monthLabel}</span>
        {!nav.isCurrentMonth && <span className={styles.currentIndicator}>●</span>}
      </button>
      {!isMobile && (
        <Button variant="ghost" size="icon" onClick={nav.goToNextMonth} className={styles.navButton} aria-label="Next month">
          <ChevronRight className="size-4" strokeWidth={1.5} />
        </Button>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.expenseByDay")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthNav}
          <div className="flex items-center justify-center py-12">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="dashboard-card" ref={cardRefCallback}>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.expenseByDay")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthNav}
          <p className="py-8 text-center text-sm text-muted-foreground">{t("home.noExpensesThisMonth")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dashboard-card" ref={cardRefCallback}>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-muted-foreground">
          {t("dashboard.expenseByDay")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {lang === "es" ? "Cada punto = un gasto (eje X: día, Y: importe)" : "Each point = one expense (X: day, Y: amount)"}
        </p>
      </CardHeader>
      <CardContent>
        {monthNav}
        <div className="dashboard-chart w-full">
          <Scatter data={scatterData} options={scatterOptions} />
        </div>
      </CardContent>
    </Card>
  );
}
