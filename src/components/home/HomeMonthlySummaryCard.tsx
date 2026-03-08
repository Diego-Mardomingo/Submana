"use client";

import { useMemo, useCallback } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";
import { formatCurrency } from "@/lib/format";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { detectTransferIds } from "@/lib/transferDetection";
import { filterForMetrics } from "@/lib/metricsFilters";
import { useCategories } from "@/hooks/useCategories";
import styles from "./HomeMonthlySummaryCard.module.css";

type Tx = { id: string; amount?: number; type?: string; date?: string; account_id?: string; category_id?: string | null; subcategory_id?: string | null };

function useMonthlyTotals(year: number, month: number) {
  const { data: transactions = [], isLoading, isFetching, isPlaceholderData } = useTransactions(year, month);
  const { data: categoriesData } = useCategories();
  return useMemo(() => {
    const txList = transactions as Tx[];
    const transferIds = detectTransferIds(txList.map((tx) => ({ id: tx.id, amount: Number(tx.amount) || 0, type: tx.type || "", date: tx.date || "", account_id: tx.account_id })));
    const ctx = {
      defaultCategories: categoriesData?.defaultCategories ?? [],
      userCategories: categoriesData?.userCategories ?? [],
    };
    const forMetrics = filterForMetrics(
      txList.filter((tx) => !transferIds.has(tx.id)),
      ctx
    );
    let income = 0;
    let expense = 0;
    for (const tx of forMetrics) {
      const amt = Number(tx.amount) || 0;
      if (tx.type === "income") income += amt;
      else expense += amt;
    }
    // isInitialLoading: true solo cuando no hay datos anteriores
    const isInitialLoading = isLoading && transactions.length === 0;
    // isRefreshing: hay datos pero se están actualizando
    const isRefreshing = isFetching && !isInitialLoading;
    return { income, expense, balance: income - expense, isInitialLoading, isRefreshing, isPlaceholderData };
  }, [transactions, categoriesData, isLoading, isFetching, isPlaceholderData]);
}

export default function HomeMonthlySummaryCard() {
  const lang = useLang();
  const t = useTranslations(lang);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const nav = useMonthNavigation(lang);

  const cardRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      nav.setSwipeElement(node);
    },
    [nav.setSwipeElement]
  );

  const prevYear = nav.month === 1 ? nav.year - 1 : nav.year;
  const prevMonth = nav.month === 1 ? 12 : nav.month - 1;

  const current = useMonthlyTotals(nav.year, nav.month);
  const previous = useMonthlyTotals(prevYear, prevMonth);

  const percentChange = useMemo(() => {
    if (previous.balance === 0) return null;
    return (
      ((current.balance - previous.balance) / Math.abs(previous.balance)) * 100
    );
  }, [current.balance, previous.balance]);

  // Solo spinner completo si no hay datos
  const isInitialLoading = current.isInitialLoading;
  // Indicador sutil si está recargando
  const isRefreshing = current.isRefreshing || previous.isRefreshing;

  if (isInitialLoading) {
    return (
      <Card className="home-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("home.monthlySummary")}
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
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle className="text-base font-semibold text-muted-foreground">
          {t("home.monthlySummary")}
        </CardTitle>
        {percentChange !== null && (
          <CardAction>
            <Badge
              variant={percentChange >= 0 ? "default" : "destructive"}
              className={
                percentChange >= 0
                  ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                  : ""
              }
            >
              {percentChange >= 0 ? (
                <TrendingUp className="mr-1 size-3" />
              ) : (
                <TrendingDown className="mr-1 size-3" />
              )}
              {percentChange >= 0 ? "+" : ""}
              {percentChange.toFixed(1)}%
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col" style={{ opacity: isRefreshing ? 0.7 : 1, transition: "opacity 0.2s" }}>
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
        <div className={styles.row}>
          <div className={styles.incomeSection}>
            <p className={styles.label}>{t("home.totalIncome")}</p>
            <p className={styles.incomeValue}>
              +<SensitiveAmount>{formatCurrency(current.income)}</SensitiveAmount>
            </p>
          </div>
          <div className={styles.expenseSection}>
            <p className={styles.label}>{t("home.totalExpenses")}</p>
            <p className={styles.expenseValue}>
              -<SensitiveAmount>{formatCurrency(current.expense)}</SensitiveAmount>
            </p>
          </div>
        </div>
        <hr className={styles.divider} />
        <div className={styles.balanceSection}>
          <p
            className={styles.balanceValue}
            style={{
              color:
                current.balance > 0
                  ? "var(--success)"
                  : current.balance < 0
                    ? "var(--danger)"
                    : "var(--accent)",
            }}
          >
            {current.balance >= 0 ? "+" : ""}
            <SensitiveAmount>{formatCurrency(current.balance)}</SensitiveAmount>
          </p>
          <p className={styles.balanceLabel}>{t("home.monthlyBalance")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
