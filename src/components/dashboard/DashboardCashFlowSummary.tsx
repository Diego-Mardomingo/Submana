"use client";

import { useMemo, useEffect, useState, useCallback } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Line } from "react-chartjs-2";
import { Spinner } from "@/components/ui/spinner";
import { tooltipConfig, getChartColors } from "@/lib/chartConfig";
import { detectTransferIds } from "@/lib/transferDetection";
import { filterForMetrics } from "@/lib/metricsFilters";
import { useCategories } from "@/hooks/useCategories";
import styles from "./DashboardMonthNav.module.css";

type Tx = { id: string; amount?: number; type?: string; date?: string; account_id?: string; category_id?: string | null; subcategory_id?: string | null };

export default function DashboardCashFlowSummary() {
  const lang = useLang();
  const t = useTranslations(lang);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const nav = useMonthNavigation(lang);

  const cardRefCallback = useCallback(
    (node: HTMLDivElement | null) => { nav.setSwipeElement(node); },
    [nav.setSwipeElement]
  );

  const { data: transactions = [], isLoading } = useTransactions(nav.year, nav.month);
  const { data: categoriesData } = useCategories();

  const prevYear = nav.month === 1 ? nav.year - 1 : nav.year;
  const prevMonth = nav.month === 1 ? 12 : nav.month - 1;
  const { data: prevTransactions = [] } = useTransactions(prevYear, prevMonth);

  const [colors, setColors] = useState({ success: "#10b981", danger: "#ef4444", muted: "#888" });
  useEffect(() => {
    const c = getChartColors();
    setColors({
      success: c.success || "#10b981",
      danger: c.danger || "#ef4444",
      muted: c.muted || "#888",
    });
  }, []);

  const data = useMemo(() => {
    const ctx = {
      defaultCategories: categoriesData?.defaultCategories ?? [],
      userCategories: categoriesData?.userCategories ?? [],
    };
    const txList = transactions as Tx[];
    const transferIds = detectTransferIds(txList.map((tx) => ({ id: tx.id, amount: Number(tx.amount) || 0, type: tx.type || "", date: tx.date || "", account_id: tx.account_id })));
    const forMetrics = filterForMetrics(
      txList.filter((tx) => !transferIds.has(tx.id)),
      ctx
    );

    let income = 0, expense = 0;
    for (const tx of forMetrics) {
      const amt = Number(tx.amount) || 0;
      if (tx.type === "income") income += amt;
      else expense += amt;
    }

    const prevList = prevTransactions as Tx[];
    const prevTransferIds = detectTransferIds(prevList.map((tx) => ({ id: tx.id, amount: Number(tx.amount) || 0, type: tx.type || "", date: tx.date || "", account_id: tx.account_id })));
    const prevForMetrics = filterForMetrics(
      prevList.filter((tx) => !prevTransferIds.has(tx.id)),
      ctx
    );

    let prevIncome = 0, prevExpense = 0;
    for (const tx of prevForMetrics) {
      const amt = Number(tx.amount) || 0;
      if (tx.type === "income") prevIncome += amt;
      else prevExpense += amt;
    }

    const net = income - expense;
    const prevNet = prevIncome - prevExpense;
    const change = prevNet !== 0 ? ((net - prevNet) / Math.abs(prevNet)) * 100 : 0;

    const daysInMonth = new Date(nav.year, nav.month, 0).getDate();
    const dailyNet = new Array(daysInMonth).fill(0);
    for (const tx of forMetrics) {
      if (!tx.date) continue;
      const d = new Date(tx.date);
      const day = d.getDate() - 1;
      if (day >= 0 && day < daysInMonth) {
        const amt = Number(tx.amount) || 0;
        dailyNet[day] += tx.type === "income" ? amt : -amt;
      }
    }

    let cumulative = 0;
    const sparkline = dailyNet.map((v) => {
      cumulative += v;
      return Math.round(cumulative * 100) / 100;
    });

    return {
      income: Math.round(income * 100) / 100,
      expense: Math.round(expense * 100) / 100,
      net: Math.round(net * 100) / 100,
      change: Math.round(change * 10) / 10,
      sparkline,
    };
  }, [transactions, prevTransactions, categoriesData, nav.year, nav.month]);

  const sparkColor = data.net >= 0 ? colors.success : colors.danger;

  const sparkData = useMemo(() => ({
    labels: data.sparkline.map((_, i) => String(i + 1)),
    datasets: [{
      data: data.sparkline,
      borderColor: sparkColor,
      backgroundColor: sparkColor + "15",
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: true,
      tension: 0.3,
    }],
  }), [data.sparkline, sparkColor]);

  const sparkOptions = useMemo(() => ({
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
      x: { display: false },
      y: { display: false },
    },
    elements: {
      line: { borderWidth: 1.5 },
    },
  }), []);

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
            {t("dashboard.cashFlowNet")}
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

  const TrendIcon = data.net > 0 ? TrendingUp : data.net < 0 ? TrendingDown : Minus;
  const trendColor = data.net >= 0 ? "text-success" : "text-danger";

  return (
    <Card className="dashboard-card" ref={cardRefCallback}>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-muted-foreground">
          {t("dashboard.cashFlowNet")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {monthNav}

        <div className="flex items-center gap-2">
          <TrendIcon className={`size-5 ${trendColor}`} strokeWidth={2} />
          <span className={`text-2xl font-bold ${trendColor}`}>
            {data.net >= 0 ? "+" : ""}{formatCurrency(data.net)}
          </span>
        </div>

        {data.change !== 0 && (
          <p className={`text-xs ${data.change >= 0 ? "text-success" : "text-danger"}`}>
            {data.change >= 0 ? "+" : ""}{data.change}% {lang === "es" ? "vs mes anterior" : "vs last month"}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{lang === "es" ? "Ingresos" : "Income"}</p>
            <p className="font-semibold text-success">+{formatCurrency(data.income)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{lang === "es" ? "Gastos" : "Expenses"}</p>
            <p className="font-semibold text-danger">-{formatCurrency(data.expense)}</p>
          </div>
        </div>

        <div className="h-16">
          <Line data={sparkData} options={sparkOptions} />
        </div>
      </CardContent>
    </Card>
  );
}
