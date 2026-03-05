"use client";

import { useMemo, useCallback, useRef, useEffect } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories, type CategoryWithSubs } from "@/hooks/useCategories";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";
import { formatCurrency } from "@/lib/format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Doughnut } from "react-chartjs-2";
import { Spinner } from "@/components/ui/spinner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { resolveChartPalette, tooltipConfig } from "@/lib/chartConfig";
import { detectTransferIds } from "@/lib/transferDetection";
import navStyles from "@/components/dashboard/DashboardMonthNav.module.css";
import styles from "./HomeCategoryDonutCard.module.css";

type Tx = {
  id: string;
  amount?: number;
  type?: string;
  date?: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  account_id?: string;
};

function buildCategoryMaps(
  defaultCats: CategoryWithSubs[],
  userCats: CategoryWithSubs[],
  lang: string
): { idToName: Map<string, string>; subToParent: Map<string, string> } {
  const idToName = new Map<string, string>();
  const subToParent = new Map<string, string>();

  const walk = (list: CategoryWithSubs[]) => {
    for (const parent of list) {
      const name = lang === "en" && parent.name_en ? parent.name_en : parent.name;
      idToName.set(parent.id, name);
      for (const sub of parent.subcategories ?? []) {
        const subName = lang === "en" && sub.name_en ? sub.name_en : sub.name;
        idToName.set(sub.id, subName);
        subToParent.set(sub.id, parent.id);
      }
    }
  };
  walk(defaultCats);
  walk(userCats);
  return { idToName, subToParent };
}

export default function HomeCategoryDonutCard() {
  const lang = useLang();
  const t = useTranslations(lang);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const colorsRef = useRef<string[]>([]);

  useEffect(() => {
    colorsRef.current = resolveChartPalette();
  }, []);

  const nav = useMonthNavigation(lang);

  const cardRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      nav.setSwipeElement(node);
    },
    [nav.setSwipeElement]
  );

  const { data: transactions = [], isLoading: txLoading, isFetching: txFetching } = useTransactions(
    nav.year,
    nav.month
  );
  const { data: categoriesData, isLoading: catLoading, isFetching: catFetching } = useCategories();

  const { chartData, totalExpense } = useMemo(() => {
    const defaultCats = categoriesData?.defaultCategories ?? [];
    const userCats = categoriesData?.userCategories ?? [];
    const { idToName, subToParent } = buildCategoryMaps(defaultCats, userCats, lang);

    const byCategory = new Map<string, number>();
    const txList = transactions as Tx[];
    const transferIds = detectTransferIds(txList.map((tx) => ({ id: tx.id, amount: Number(tx.amount) || 0, type: tx.type || "", date: tx.date || "", account_id: tx.account_id })));

    for (const tx of txList) {
      if (tx.type !== "expense" || transferIds.has(tx.id)) continue;
      const amt = Number(tx.amount) || 0;
      const parentId =
        tx.category_id ??
        (tx.subcategory_id ? subToParent.get(tx.subcategory_id) : undefined) ??
        tx.subcategory_id ??
        "__uncategorized__";
      byCategory.set(parentId, (byCategory.get(parentId) ?? 0) + amt);
    }

    const total = Array.from(byCategory.values()).reduce((s, v) => s + v, 0);
    const data = Array.from(byCategory.entries()).map(([id, value]) => ({
      name: id === "__uncategorized__" ? t("home.uncategorized") : idToName.get(id) ?? id,
      value: Math.round(value * 100) / 100,
      id,
    }));

    data.sort((a, b) => b.value - a.value);
    return { chartData: data, totalExpense: total };
  }, [transactions, categoriesData, lang, t]);

  const isInitialLoading = (txLoading && transactions.length === 0) || (catLoading && !categoriesData);
  const isRefreshing = (txFetching || catFetching) && !isInitialLoading;

  const colors = colorsRef.current.length > 0 ? colorsRef.current : resolveChartPalette();

  const labelsWithPct = useMemo(() =>
    chartData.map((d) => {
      const pct = totalExpense > 0 ? ((d.value / totalExpense) * 100).toFixed(0) : "0";
      return `${d.name} (${pct}%)`;
    }),
  [chartData, totalExpense]);

  const doughnutData = useMemo(() => ({
    labels: labelsWithPct,
    datasets: [
      {
        data: chartData.map((d) => d.value),
        backgroundColor: chartData.map((_, i) => colors[i % colors.length]),
        borderWidth: 0,
        hoverOffset: 6,
      },
    ],
  }), [chartData, labelsWithPct, colors]);

  const doughnutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: "55%",
    plugins: {
      tooltip: {
        ...tooltipConfig(),
        callbacks: {
          label: (ctx: { label?: string; parsed: number }) => {
            const name = chartData[ctx.parsed] ? chartData[ctx.parsed].name : ctx.label ?? "";
            const pct = totalExpense > 0 ? ((ctx.parsed / totalExpense) * 100).toFixed(1) : "0";
            return `${name}: ${formatCurrency(ctx.parsed)} (${pct}%)`;
          },
        },
      },
      legend: {
        position: "right" as const,
        labels: {
          boxWidth: isMobile ? 6 : 8,
          usePointStyle: true,
          pointStyle: "circle" as const,
          font: { size: isMobile ? 9 : 11 },
        },
      },
    },
  }), [isMobile, totalExpense, chartData]);

  if (isInitialLoading) {
    return (
      <Card className="home-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("home.expensesByCategory")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Spinner className="size-6 text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="home-card" ref={cardRefCallback}>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-muted-foreground">
          {t("home.expensesByCategory")}
        </CardTitle>
      </CardHeader>
      <CardContent style={{ opacity: isRefreshing ? 0.7 : 1, transition: "opacity 0.2s" }}>
        <div className={navStyles.monthNav}>
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={nav.goToPrevMonth}
              className={navStyles.navButton}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" strokeWidth={1.5} />
            </Button>
          )}
          <button
            type="button"
            onClick={nav.goToCurrentMonth}
            className={navStyles.monthLabel}
            title={nav.isCurrentMonth ? undefined : t("calendar.today")}
          >
            <span>{nav.monthLabel}</span>
            {!nav.isCurrentMonth && (
              <span className={navStyles.currentIndicator}>●</span>
            )}
          </button>
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={nav.goToNextMonth}
              className={navStyles.navButton}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </Button>
          )}
        </div>
        {chartData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("home.noExpensesThisMonth")}
          </p>
        ) : (
          <div className={styles.chartWrapper}>
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
