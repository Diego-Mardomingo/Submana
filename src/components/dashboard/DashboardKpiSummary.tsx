"use client";

import { useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, Wallet } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

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

export default function DashboardKpiSummary() {
  const lang = useLang();
  const t = useTranslations(lang);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;

  const current = useMonthlyTotals(currentYear, currentMonth);
  const previous = useMonthlyTotals(prevYear, prevMonth);

  const percentChange = useMemo(() => {
    if (previous.balance === 0) return null;
    return ((current.balance - previous.balance) / Math.abs(previous.balance)) * 100;
  }, [current.balance, previous.balance]);

  const isLoading = current.isLoading || previous.isLoading;

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardContent className="flex items-center justify-center py-16">
          <Spinner className="size-8 text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dashboard-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-muted-foreground">
          {t("dashboard.monthlySummary")}
        </CardTitle>
        {percentChange !== null && (
          <Badge
            variant={percentChange >= 0 ? "default" : "destructive"}
            className={
              percentChange >= 0
                ? "absolute right-4 top-4 bg-emerald-600 hover:bg-emerald-600 text-white"
                : "absolute right-4 top-4"
            }
          >
            {percentChange >= 0 ? <TrendingUp className="mr-1 size-3" /> : <TrendingDown className="mr-1 size-3" />}
            {percentChange >= 0 ? "+" : ""}
            {percentChange.toFixed(1)}%
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="flex flex-col items-center sm:items-start p-4 rounded-xl" style={{ backgroundColor: "var(--success-soft)", border: "1px solid var(--success-muted)" }}>
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpCircle className="size-5" style={{ color: "var(--success)" }} />
              <span className="text-sm font-medium text-muted-foreground">{t("home.totalIncome")}</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold" style={{ color: "var(--success)" }}>+{formatCurrency(current.income)}</p>
          </div>
          <div className="flex flex-col items-center sm:items-start p-4 rounded-xl" style={{ backgroundColor: "var(--danger-soft)", border: "1px solid var(--danger-muted)" }}>
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownCircle className="size-5" style={{ color: "var(--danger)" }} />
              <span className="text-sm font-medium text-muted-foreground">{t("home.totalExpenses")}</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold" style={{ color: "var(--danger)" }}>-{formatCurrency(current.expense)}</p>
          </div>
          <div className="flex flex-col items-center sm:items-start p-4 rounded-xl" style={{ backgroundColor: "var(--accent-soft)", border: "1px solid var(--accent-muted)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="size-5" style={{ color: "var(--accent)" }} />
              <span className="text-sm font-medium text-muted-foreground">{t("home.monthlyBalance")}</span>
            </div>
            <p
              className="text-xl sm:text-2xl font-bold"
              style={{
                color: current.balance > 0 ? "var(--success)" : current.balance < 0 ? "var(--danger)" : "var(--accent)",
              }}
            >
              {current.balance >= 0 ? "+" : ""}
              {formatCurrency(current.balance)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
