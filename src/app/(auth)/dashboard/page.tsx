"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { useAccounts } from "@/hooks/useAccounts";
import { useDashboardPrefetch } from "@/hooks/useDashboardPrefetch";
import { LayoutDashboard } from "lucide-react";
import HomeBalanceCard from "@/components/home/HomeBalanceCard";
import HomeMonthlySummaryCard from "@/components/home/HomeMonthlySummaryCard";
import HomeBudgetsCard from "@/components/home/HomeBudgetsCard";
import { ChartSkeleton } from "@/components/dashboard/ChartSkeleton";
import DashboardAccountTrendLine from "@/components/dashboard/DashboardAccountTrendLine";
import "@/lib/chartConfig";
import { BalanceTrendRangeProvider } from "@/contexts/BalanceTrendRangeContext";

const HomeCategoryDonutCard = dynamic(
  () => import("@/components/home/HomeCategoryDonutCard"),
  { loading: () => <ChartSkeleton height="h-[220px]" />, ssr: false }
);

const DashboardMonthlyTrendBars = dynamic(
  () => import("@/components/dashboard/DashboardMonthlyTrendBars"),
  { loading: () => <ChartSkeleton height="h-[200px]" />, ssr: false }
);

const DashboardDailyExpenseBars = dynamic(
  () => import("@/components/dashboard/DashboardDailyExpenseBars"),
  { loading: () => <ChartSkeleton height="h-[200px]" />, ssr: false }
);

const DashboardBalanceByAccountDonut = dynamic(
  () => import("@/components/dashboard/DashboardBalanceByAccountDonut"),
  { loading: () => <ChartSkeleton height="h-[200px]" />, ssr: false }
);

const DashboardTopCategoriesBar = dynamic(
  () => import("@/components/dashboard/DashboardTopCategoriesBar"),
  { loading: () => <ChartSkeleton height="h-[200px]" />, ssr: false }
);

const DashboardSpendingForecast = dynamic(
  () => import("@/components/dashboard/DashboardSpendingForecast"),
  { loading: () => <ChartSkeleton height="h-[200px]" />, ssr: false }
);

const DashboardTopExpenses = dynamic(
  () => import("@/components/dashboard/DashboardTopExpenses"),
  { loading: () => <ChartSkeleton height="h-[200px]" />, ssr: false }
);

const DashboardAnnualSavingsProjection = dynamic(
  () => import("@/components/dashboard/DashboardAnnualSavingsProjection"),
  { loading: () => <ChartSkeleton height="h-[200px]" />, ssr: false }
);

const DashboardMonthComparisonBar = dynamic(
  () => import("@/components/dashboard/DashboardMonthComparisonBar"),
  { loading: () => <ChartSkeleton height="h-[200px]" />, ssr: false }
);

const DashboardSubscriptionsCard = dynamic(
  () => import("@/components/dashboard/DashboardSubscriptionsCard"),
  { loading: () => <ChartSkeleton height="h-[200px]" />, ssr: false }
);

const DashboardExpenseScatter = dynamic(
  () => import("@/components/dashboard/DashboardExpenseScatter"),
  { loading: () => <ChartSkeleton height="h-[200px]" />, ssr: false }
);

const DashboardCashFlowSummary = dynamic(
  () => import("@/components/dashboard/DashboardCashFlowSummary"),
  { loading: () => <ChartSkeleton height="h-[200px]" />, ssr: false }
);

const DashboardBalanceTrendLine = dynamic(
  () => import("@/components/dashboard/DashboardBalanceTrendLine"),
  { loading: () => <ChartSkeleton height="h-[250px]" />, ssr: false }
);

export default function DashboardPage() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: accounts = [] } = useAccounts();
  
  useDashboardPrefetch();

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
          <div className="dashboard-card" data-card-id="2">
            <HomeMonthlySummaryCard />
          </div>
          <div className="dashboard-card" data-card-id="3">
            <HomeBudgetsCard />
          </div>

          <div className="dashboard-card" data-card-id="4">
            <HomeCategoryDonutCard />
          </div>
          <div className="dashboard-card" data-card-id="5">
            <DashboardMonthlyTrendBars />
          </div>

          <div className="dashboard-card" data-card-id="6">
            <DashboardDailyExpenseBars />
          </div>
          <div className="dashboard-card" data-card-id="7">
            <DashboardBalanceByAccountDonut />
          </div>

          <div className="dashboard-card" data-card-id="8">
            <DashboardTopCategoriesBar />
          </div>
          <div className="dashboard-card" data-card-id="9">
            <DashboardSpendingForecast />
          </div>

          <div className="dashboard-card" data-card-id="10">
            <DashboardTopExpenses />
          </div>
          <div className="dashboard-card" data-card-id="11">
            <DashboardAnnualSavingsProjection />
          </div>

          <div className="dashboard-card" data-card-id="12">
            <DashboardMonthComparisonBar />
          </div>
          <div className="dashboard-card" data-card-id="13">
            <DashboardSubscriptionsCard />
          </div>

          <div className="dashboard-card" data-card-id="14">
            <DashboardExpenseScatter />
          </div>
          <div className="dashboard-card" data-card-id="15">
            <DashboardCashFlowSummary />
          </div>

          <BalanceTrendRangeProvider>
            <div className="dashboard-grid-full" data-card-id="16">
              <DashboardBalanceTrendLine />
            </div>

            {accounts.map((acc: { id: string; name: string; color?: string; balance?: number }, idx: number) => (
              <div key={acc.id} className="dashboard-grid-full" data-card-id={`${17 + idx}`}>
                <DashboardAccountTrendLine
                  accountId={acc.id}
                  accountName={acc.name}
                  accountColor={acc.color ?? "var(--accent)"}
                  accountBalance={Number(acc.balance ?? 0)}
                />
              </div>
            ))}
          </BalanceTrendRangeProvider>
        </div>
      </section>
    </div>
  );
}
