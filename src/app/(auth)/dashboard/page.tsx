"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { useDashboardPrefetch } from "@/hooks/useDashboardPrefetch";
import { LayoutDashboard } from "lucide-react";
import HomeBalanceCard from "@/components/home/HomeBalanceCard";
import HomeMonthlySummaryCard from "@/components/home/HomeMonthlySummaryCard";
import HomeBudgetsCard from "@/components/home/HomeBudgetsCard";
import { ChartSkeleton } from "@/components/dashboard/ChartSkeleton";

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

const DashboardBudgetsProgress = dynamic(
  () => import("@/components/dashboard/DashboardBudgetsProgress"),
  { loading: () => <ChartSkeleton height="h-[180px]" />, ssr: false }
);

const DashboardCashFlowArea = dynamic(
  () => import("@/components/dashboard/DashboardCashFlowArea"),
  { loading: () => <ChartSkeleton height="h-[200px]" />, ssr: false }
);

const DashboardIncomeByCategoryDonut = dynamic(
  () => import("@/components/dashboard/DashboardIncomeByCategoryDonut"),
  { loading: () => <ChartSkeleton height="h-[200px]" />, ssr: false }
);

const DashboardExpenseByAccountDonut = dynamic(
  () => import("@/components/dashboard/DashboardExpenseByAccountDonut"),
  { loading: () => <ChartSkeleton height="h-[200px]" />, ssr: false }
);

const DashboardMonthComparisonBar = dynamic(
  () => import("@/components/dashboard/DashboardMonthComparisonBar"),
  { loading: () => <ChartSkeleton height="h-[200px]" />, ssr: false }
);

const DashboardBalanceTrendLine = dynamic(
  () => import("@/components/dashboard/DashboardBalanceTrendLine"),
  { loading: () => <ChartSkeleton height="h-[250px]" />, ssr: false }
);

const DashboardSubscriptionsCard = dynamic(
  () => import("@/components/dashboard/DashboardSubscriptionsCard"),
  { loading: () => <ChartSkeleton height="h-[200px]" />, ssr: false }
);

const DashboardExpenseScatter = dynamic(
  () => import("@/components/dashboard/DashboardExpenseScatter"),
  { loading: () => <ChartSkeleton height="h-[200px]" />, ssr: false }
);

const DashboardSavingsRateRadial = dynamic(
  () => import("@/components/dashboard/DashboardSavingsRateRadial"),
  { loading: () => <ChartSkeleton height="h-[200px]" />, ssr: false }
);

export default function DashboardPage() {
  const lang = useLang();
  const t = useTranslations(lang);
  
  // Prefetch datos de meses adyacentes para navegación fluida
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
            <DashboardBudgetsProgress />
          </div>

          <div className="dashboard-card" data-card-id="9">
            <DashboardCashFlowArea />
          </div>
          <div className="dashboard-card" data-card-id="10">
            <DashboardIncomeByCategoryDonut />
          </div>

          <div className="dashboard-card" data-card-id="11">
            <DashboardExpenseByAccountDonut />
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
            <DashboardSavingsRateRadial />
          </div>

          <div className="dashboard-grid-full" data-card-id="16">
            <DashboardBalanceTrendLine />
          </div>
        </div>
      </section>
    </div>
  );
}
