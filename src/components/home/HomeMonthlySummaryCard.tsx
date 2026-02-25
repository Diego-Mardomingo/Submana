"use client";

import { useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { formatCurrency } from "@/lib/format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import styles from "./HomeMonthlySummaryCard.module.css";

type Tx = { amount?: number; type?: string };

function useMonthlyTotals(year: number, month: number) {
  const { data: transactions = [], isLoading } = useTransactions(year, month);
  return useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of transactions as Tx[]) {
      const amt = Number(tx.amount) || 0;
      if (tx.type === "income") income += amt;
      else expense += amt;
    }
    return { income, expense, balance: income - expense, isLoading };
  }, [transactions, isLoading]);
}

export default function HomeMonthlySummaryCard() {
  const lang = useLang();
  const t = useTranslations(lang);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12 for API

  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;

  const current = useMonthlyTotals(currentYear, currentMonth);
  const previous = useMonthlyTotals(prevYear, prevMonth);

  const percentChange = useMemo(() => {
    if (previous.balance === 0) return null;
    return (
      ((current.balance - previous.balance) / Math.abs(previous.balance)) * 100
    );
  }, [current.balance, previous.balance]);

  const isLoading = current.isLoading || previous.isLoading;

  if (isLoading) {
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
    <Card className="home-card">
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
      <CardContent className="flex flex-col">
        <div className={styles.row}>
          <div className={styles.incomeSection}>
            <p className={styles.label}>{t("home.totalIncome")}</p>
            <p className={styles.incomeValue}>+{formatCurrency(current.income)}</p>
          </div>
          <div className={styles.expenseSection}>
            <p className={styles.label}>{t("home.totalExpenses")}</p>
            <p className={styles.expenseValue}>
              -{formatCurrency(current.expense)}
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
            {formatCurrency(current.balance)}
          </p>
          <p className={styles.balanceLabel}>{t("home.monthlyBalance")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
