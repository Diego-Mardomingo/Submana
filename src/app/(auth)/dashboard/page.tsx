"use client";

import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import HomeBalanceCard from "@/components/home/HomeBalanceCard";
import HomeMonthlySummaryCard from "@/components/home/HomeMonthlySummaryCard";
import HomeBudgetsCard from "@/components/home/HomeBudgetsCard";
import HomeCategoryDonutCard from "@/components/home/HomeCategoryDonutCard";
import DashboardMonthlyTrendBars from "@/components/dashboard/DashboardMonthlyTrendBars";
import DashboardTopCategoriesBar from "@/components/dashboard/DashboardTopCategoriesBar";
import DashboardDailyExpenseBars from "@/components/dashboard/DashboardDailyExpenseBars";
import DashboardBalanceByAccountDonut from "@/components/dashboard/DashboardBalanceByAccountDonut";
import DashboardBudgetsProgress from "@/components/dashboard/DashboardBudgetsProgress";
import DashboardCashFlowArea from "@/components/dashboard/DashboardCashFlowArea";
import DashboardIncomeByCategoryDonut from "@/components/dashboard/DashboardIncomeByCategoryDonut";
import DashboardExpenseByAccountDonut from "@/components/dashboard/DashboardExpenseByAccountDonut";
import DashboardMonthComparisonBar from "@/components/dashboard/DashboardMonthComparisonBar";
import DashboardBalanceTrendLine from "@/components/dashboard/DashboardBalanceTrendLine";
import DashboardSubscriptionsCard from "@/components/dashboard/DashboardSubscriptionsCard";
import DashboardExpenseScatter from "@/components/dashboard/DashboardExpenseScatter";
import DashboardSavingsRateRadial from "@/components/dashboard/DashboardSavingsRateRadial";

export default function DashboardPage() {
  const lang = useLang();
  const t = useTranslations(lang);

  return (
    <div className="page-container dashboard-page fade-in">
      <header className="page-header">
        <h1 className="title">{t("nav.dashboard")}</h1>
      </header>
      <section className="dashboard-content">
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <HomeBalanceCard />
          </div>
          <div className="dashboard-card">
            <HomeMonthlySummaryCard />
          </div>
          <div className="dashboard-card">
            <HomeBudgetsCard />
          </div>

          <div className="dashboard-card">
            <HomeCategoryDonutCard />
          </div>
          <div className="dashboard-card">
            <DashboardMonthlyTrendBars />
          </div>

          <div className="dashboard-card">
            <DashboardTopCategoriesBar />
          </div>
          <div className="dashboard-card">
            <DashboardDailyExpenseBars />
          </div>

          <div className="dashboard-card">
            <DashboardBalanceByAccountDonut />
          </div>
          <div className="dashboard-card">
            <DashboardBudgetsProgress />
          </div>

          <div className="dashboard-card">
            <DashboardCashFlowArea />
          </div>
          <div className="dashboard-card">
            <DashboardIncomeByCategoryDonut />
          </div>

          <div className="dashboard-card">
            <DashboardExpenseByAccountDonut />
          </div>
          <div className="dashboard-card">
            <DashboardMonthComparisonBar />
          </div>

          <div className="dashboard-card">
            <DashboardSubscriptionsCard />
          </div>
          <div className="dashboard-card">
            <DashboardExpenseScatter />
          </div>

          <div className="dashboard-card">
            <DashboardSavingsRateRadial />
          </div>

          <div className="dashboard-grid-full">
            <DashboardBalanceTrendLine />
          </div>
        </div>
      </section>
    </div>
  );
}
