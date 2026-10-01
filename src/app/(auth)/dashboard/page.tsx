"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard } from "lucide-react";
import { ChartSkeleton } from "@/components/dashboard/ChartSkeleton";
import HomeBalanceCard from "@/components/home/HomeBalanceCard";
import HomeBudgetsCard from "@/components/home/HomeBudgetsCard";
import HomeMonthlySummaryCard from "@/components/home/HomeMonthlySummaryCard";
import { BalanceTrendRangeProvider } from "@/contexts/BalanceTrendRangeContext";
import { useAccounts } from "@/hooks/useAccounts";
import { useLang } from "@/hooks/useLang";
import { prefetchMonth } from "@/hooks/useTransactions";
import { appNow, shiftMonth } from "@/lib/date";
import { useTranslations } from "@/lib/i18n/utils";

// Charts need the browser (canvas, CSS variables): load them client-side with a skeleton.
const loading = () => <ChartSkeleton />;
const HomeCategoryDonutCard = dynamic(() => import("@/components/home/HomeCategoryDonutCard"), { loading, ssr: false });
const DashboardMonthlyTrendBars = dynamic(() => import("@/components/dashboard/DashboardMonthlyTrendBars"), { loading, ssr: false });
const DashboardDailyExpenseBars = dynamic(() => import("@/components/dashboard/DashboardDailyExpenseBars"), { loading, ssr: false });
const DashboardBalanceByAccountDonut = dynamic(() => import("@/components/dashboard/DashboardBalanceByAccountDonut"), { loading, ssr: false });
const DashboardTopCategoriesBar = dynamic(() => import("@/components/dashboard/DashboardTopCategoriesBar"), { loading, ssr: false });
const DashboardSpendingForecast = dynamic(() => import("@/components/dashboard/DashboardSpendingForecast"), { loading, ssr: false });
const DashboardTopExpenses = dynamic(() => import("@/components/dashboard/DashboardTopExpenses"), { loading, ssr: false });
const DashboardAnnualSavingsProjection = dynamic(() => import("@/components/dashboard/DashboardAnnualSavingsProjection"), { loading, ssr: false });
const DashboardMonthComparisonBar = dynamic(() => import("@/components/dashboard/DashboardMonthComparisonBar"), { loading, ssr: false });
const DashboardSubscriptionsCard = dynamic(() => import("@/components/dashboard/DashboardSubscriptionsCard"), { loading, ssr: false });
const DashboardExpenseScatter = dynamic(() => import("@/components/dashboard/DashboardExpenseScatter"), { loading, ssr: false });
const DashboardCashFlowSummary = dynamic(() => import("@/components/dashboard/DashboardCashFlowSummary"), { loading, ssr: false });
const DashboardBalanceTrendLine = dynamic(() => import("@/components/dashboard/DashboardBalanceTrendLine"), {
  loading: () => <ChartSkeleton height="h-[250px]" />,
  ssr: false,
});

const CARDS = [
  HomeMonthlySummaryCard,
  HomeBudgetsCard,
  HomeCategoryDonutCard,
  DashboardMonthlyTrendBars,
  DashboardDailyExpenseBars,
  DashboardBalanceByAccountDonut,
  DashboardTopCategoriesBar,
  DashboardSpendingForecast,
  DashboardTopExpenses,
  DashboardAnnualSavingsProjection,
  DashboardMonthComparisonBar,
  DashboardSubscriptionsCard,
  DashboardExpenseScatter,
  DashboardCashFlowSummary,
];

type Account = { id: string; name: string; color?: string | null; balance?: number };

export default function DashboardPage() {
  const t = useTranslations(useLang());
  const { data: accounts = [] } = useAccounts();
  const queryClient = useQueryClient();

  // Warm the caches for the month-based widgets (current month ± 2).
  useEffect(() => {
    const now = appNow();
    for (let delta = -2; delta <= 2; delta++) {
      const { year, month } = shiftMonth(now.getFullYear(), now.getMonth() + 1, delta);
      prefetchMonth(queryClient, year, month, delta === 0 ? 5 * 60 * 1000 : 15 * 60 * 1000);
    }
  }, [queryClient]);

  const totalBalance = (accounts as Account[]).reduce((sum, acc) => sum + Number(acc.balance ?? 0), 0);

  return (
    <div className="page-container dashboard-page fade-in">
      <header className="page-header-clean">
        <div className="page-header-left">
          <div className="page-header-icon">
            <LayoutDashboard size={26} strokeWidth={1.5} />
          </div>
          <div className="page-header-text">
            <h1>{t("nav.dashboard")}</h1>
            <p>{t("dashboard.subtitle")}</p>
          </div>
        </div>
      </header>
      <section className="dashboard-content">
        <div className="dashboard-grid">
          <div className="dashboard-card dashboard-card-wide" data-card-id="1">
            <HomeBalanceCard />
          </div>
          {CARDS.map((Card, i) => (
            <div key={i} className="dashboard-card" data-card-id={i + 2}>
              <Card />
            </div>
          ))}

          <BalanceTrendRangeProvider>
            <div className="dashboard-grid-full" data-card-id="16">
              <DashboardBalanceTrendLine title={t("dashboard.balanceTrend")} balance={totalBalance} />
            </div>
            {(accounts as Account[]).map((acc, i) => (
              <div key={acc.id} className="dashboard-grid-full" data-card-id={17 + i}>
                <DashboardBalanceTrendLine
                  accountId={acc.id}
                  balance={Number(acc.balance ?? 0)}
                  color={acc.color}
                  title={
                    <span className="flex items-center gap-2">
                      <span className="inline-block size-3 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color ?? "var(--accent)" }} />
                      {acc.name}
                    </span>
                  }
                />
              </div>
            ))}
          </BalanceTrendRangeProvider>
        </div>
      </section>
    </div>
  );
}
