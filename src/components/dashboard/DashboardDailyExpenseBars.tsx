"use client";

import { useMemo, useState, useCallback } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Bar } from "react-chartjs-2";
import { Spinner } from "@/components/ui/spinner";
import { tooltipConfig, axisConfig, formatK } from "@/lib/chartConfig";
import { detectTransferIds } from "@/lib/transferDetection";
import { filterForMetrics } from "@/lib/metricsFilters";
import { useCategories } from "@/hooks/useCategories";
import styles from "./DashboardMonthNav.module.css";

type Tx = { id: string; amount?: number; type?: string; date?: string; account_id?: string; category_id?: string | null; subcategory_id?: string | null };
type Period = "week" | "month" | "year";

const WEEKDAY_KEYS = ["calendar.monday", "calendar.tuesday", "calendar.wednesday", "calendar.thursday", "calendar.friday", "calendar.saturday", "calendar.sunday"] as const;
const MONTH_KEYS = ["calendar.months.january", "calendar.months.february", "calendar.months.march", "calendar.months.april", "calendar.months.may", "calendar.months.june", "calendar.months.july", "calendar.months.august", "calendar.months.september", "calendar.months.october", "calendar.months.november", "calendar.months.december"] as const;

export default function DashboardDailyExpenseBars() {
  const lang = useLang();
  const t = useTranslations(lang);
  const [period, setPeriod] = useState<Period>("month");
  const dangerColor = "var(--danger)";
  const isMobile = useMediaQuery("(max-width: 768px)");
  const nav = useMonthNavigation(lang, { periodUnit: period, swipeUnit: period });

  const cardRefCallback = useCallback(
    (node: HTMLDivElement | null) => { nav.setSwipeElement(node); },
    [nav]
  );

  const { data: monthTx = [], isLoading: loadingMonth } = useTransactions(
    nav.year,
    nav.month
  );

  const { data: yearTx = [], isLoading: loadingYear } = useTransactions(
    nav.year,
    undefined
  );
  const { data: weekStartYearTx = [], isLoading: loadingWeekStartYear } = useTransactions(
    nav.weekStart.getFullYear(),
    undefined
  );
  const { data: weekEndYearTx = [], isLoading: loadingWeekEndYear } = useTransactions(
    nav.weekEnd.getFullYear(),
    undefined
  );
  const { data: categoriesData } = useCategories();

  const weekTx = useMemo(() => {
    const merged = new Map<string, Tx>();
    for (const tx of weekStartYearTx as Tx[]) merged.set(tx.id, tx);
    for (const tx of weekEndYearTx as Tx[]) merged.set(tx.id, tx);
    return Array.from(merged.values());
  }, [weekStartYearTx, weekEndYearTx]);

  const transactions = period === "year" ? yearTx : period === "week" ? weekTx : monthTx;
  const isLoading =
    period === "year"
      ? loadingYear
      : period === "week"
        ? loadingWeekStartYear || loadingWeekEndYear
        : loadingMonth;

  const { labels, values, title } = useMemo(() => {
    const ctx = {
      defaultCategories: categoriesData?.defaultCategories ?? [],
      userCategories: categoriesData?.userCategories ?? [],
    };
    const txList = transactions as Tx[];
    const transferIds = detectTransferIds(txList.map((tx) => ({ id: tx.id, amount: Number(tx.amount) || 0, type: tx.type || "", date: tx.date || "", account_id: tx.account_id })));
    const forMetrics = filterForMetrics(
      txList.filter((tx) => tx.type === "expense" && !transferIds.has(tx.id)),
      ctx
    );

    if (period === "week") {
      const weekStart = nav.weekStart;
      const weekEnd = nav.weekEnd;

      const byDay = new Map<number, number>();
      for (let i = 0; i < 7; i++) byDay.set(i, 0);

      for (const tx of forMetrics) {
        const d = tx.date ? new Date(tx.date) : null;
        if (!d || d < weekStart || d > weekEnd) continue;
        const dayIndex = Math.floor((d.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
        byDay.set(dayIndex, (byDay.get(dayIndex) ?? 0) + Number(tx.amount || 0));
      }

      const labels = Array.from({ length: 7 }, (_, i) => t(WEEKDAY_KEYS[i]));
      const values = Array.from({ length: 7 }, (_, i) => Math.round((byDay.get(i) ?? 0) * 100) / 100);
      return { labels, values, title: t("dashboard.expenseWeekly") };
    }

    if (period === "month") {
      const year = nav.year;
      const month = nav.month - 1;
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const byDay = new Map<number, number>();
      for (let i = 1; i <= daysInMonth; i++) byDay.set(i, 0);

      for (const tx of forMetrics) {
        const d = tx.date ? new Date(tx.date) : null;
        if (!d || d.getMonth() !== month || d.getFullYear() !== year) continue;
        const day = d.getDate();
        byDay.set(day, (byDay.get(day) ?? 0) + Number(tx.amount || 0));
      }

      const labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
      const values = Array.from({ length: daysInMonth }, (_, i) => Math.round((byDay.get(i + 1) ?? 0) * 100) / 100);
      return { labels, values, title: t("dashboard.expenseMonthly") };
    }

    const year = nav.year;
    const byMonth = new Map<number, number>();
    for (let i = 0; i < 12; i++) byMonth.set(i, 0);

    for (const tx of forMetrics) {
      const d = tx.date ? new Date(tx.date) : null;
      if (!d || d.getFullYear() !== year) continue;
      const monthIdx = d.getMonth();
      byMonth.set(monthIdx, (byMonth.get(monthIdx) ?? 0) + Number(tx.amount || 0));
    }

    const labels = Array.from({ length: 12 }, (_, i) => t(MONTH_KEYS[i]).slice(0, 3));
    const values = Array.from({ length: 12 }, (_, i) => Math.round((byMonth.get(i) ?? 0) * 100) / 100);
    return { labels, values, title: t("dashboard.expenseYearly") };
  }, [transactions, categoriesData, t, period, nav.year, nav.month, nav.weekStart, nav.weekEnd]);

  const barData = useMemo(() => ({
    labels,
    datasets: [{
      data: values,
      backgroundColor: dangerColor,
      borderRadius: 4,
    }],
  }), [labels, values, dangerColor]);

  const maxTicksLimit = useMemo(() => {
    if (period === "week") return 7;
    if (period === "month") return isMobile ? 8 : 15;
    return isMobile ? 6 : 12;
  }, [period, isMobile]);

  const barOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      tooltip: {
        ...tooltipConfig(),
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) => formatCurrency(ctx.parsed.y ?? 0),
        },
      },
      legend: { display: false },
    },
    scales: {
      x: {
        ...axisConfig(),
        ticks: { ...axisConfig().ticks, maxTicksLimit, font: { size: period === "month" ? 8 : 10 } },
      },
      y: {
        ...axisConfig(),
        ticks: { ...axisConfig().ticks, callback: formatK },
      },
    },
  }), [period, maxTicksLimit]);

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

  const monthNav = (
    <div className={styles.monthNav}>
      {!isMobile && (
        <Button variant="ghost" size="icon" onClick={nav.goToPrevPeriod} className={styles.navButton} aria-label="Previous period">
          <ChevronLeft className="size-4" strokeWidth={1.5} />
        </Button>
      )}
      <button type="button" onClick={nav.goToCurrentPeriod} className={styles.monthLabel} title={nav.isCurrentPeriod ? undefined : t("calendar.today")}>
        <span>{nav.periodLabel}</span>
        {!nav.isCurrentPeriod && <span className={styles.currentIndicator}>●</span>}
      </button>
      {!isMobile && (
        <Button variant="ghost" size="icon" onClick={nav.goToNextPeriod} className={styles.navButton} aria-label="Next period">
          <ChevronRight className="size-4" strokeWidth={1.5} />
        </Button>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">{title}</CardTitle>
          {periodButtons}
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

  return (
    <Card className="dashboard-card" ref={cardRefCallback}>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-muted-foreground">{title}</CardTitle>
        {periodButtons}
      </CardHeader>
      <CardContent>
        {monthNav}
        <div className="dashboard-chart w-full">
          <Bar data={barData} options={barOptions} />
        </div>
      </CardContent>
    </Card>
  );
}
