"use client";

import { useMemo, useCallback } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories, type CategoryWithSubs } from "@/hooks/useCategories";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";
import { useChartTooltipControl } from "@/hooks/useChartTooltipControl";
import { formatCurrency } from "@/lib/format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { chartTooltipStyle } from "@/components/ui/chart-tooltip";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Spinner } from "@/components/ui/spinner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./HomeCategoryDonutCard.module.css";

/* Variables CSS del tema (--chart-* ya son colores completos: accent, success, info, warning, teal) */
const CATEGORY_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--danger)",
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
];

type Tx = {
  amount?: number;
  type?: string;
  category_id?: string | null;
  subcategory_id?: string | null;
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
  const { containerRef: chartContainerRef } = useChartTooltipControl();

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
    const { idToName, subToParent } = buildCategoryMaps(
      defaultCats,
      userCats,
      lang
    );

    const byCategory = new Map<string, number>();

    for (const tx of transactions as Tx[]) {
      if (tx.type !== "expense") continue;
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
        <div className={styles.monthNav}>
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={nav.goToPrevMonth}
              className={styles.navButton}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" strokeWidth={1.5} />
            </Button>
          )}
          <button
            type="button"
            onClick={nav.goToCurrentMonth}
            className={styles.monthLabel}
            title={nav.isCurrentMonth ? undefined : t("calendar.today")}
          >
            <span>{nav.monthLabel}</span>
            {!nav.isCurrentMonth && (
              <span className={styles.currentIndicator}>●</span>
            )}
          </button>
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={nav.goToNextMonth}
              className={styles.navButton}
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
          <div className={styles.chartWrapper} ref={chartContainerRef}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={1}
                  stroke="transparent"
                >
                  {chartData.map((_, index) => (
                    <Cell
                      key={index}
                      fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [
                    formatCurrency(value),
                    totalExpense > 0
                      ? `${((value / totalExpense) * 100).toFixed(1)}%`
                      : "",
                  ]}
                  {...chartTooltipStyle}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  iconSize={isMobile ? 6 : 8}
                  iconType="circle"
                  wrapperStyle={{ fontSize: isMobile ? "0.6rem" : undefined }}
                  formatter={(value, _entry) => {
                    const item = chartData.find((d) => d.name === value);
                    const pct =
                      item && totalExpense > 0
                        ? ((item.value / totalExpense) * 100).toFixed(0)
                        : "0";
                    return `${value} (${pct}%)`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
