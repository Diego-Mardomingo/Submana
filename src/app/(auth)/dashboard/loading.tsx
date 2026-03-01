"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { LayoutDashboard } from "lucide-react";

export default function DashboardLoading() {
  const lang = useLang();
  const t = useTranslations(lang);

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
          <div className="dashboard-card dashboard-card-wide">
            <Skeleton className="h-[120px] w-full rounded-xl" />
          </div>
          <div className="dashboard-card">
            <Skeleton className="h-[180px] w-full rounded-xl" />
          </div>
          <div className="dashboard-card">
            <Skeleton className="h-[180px] w-full rounded-xl" />
          </div>
          <div className="dashboard-card">
            <Skeleton className="h-[240px] w-full rounded-xl" />
          </div>
          <div className="dashboard-card">
            <Skeleton className="h-[240px] w-full rounded-xl" />
          </div>
          <div className="dashboard-card">
            <Skeleton className="h-[240px] w-full rounded-xl" />
          </div>
          <div className="dashboard-card">
            <Skeleton className="h-[240px] w-full rounded-xl" />
          </div>
          <div className="dashboard-card">
            <Skeleton className="h-[180px] w-full rounded-xl" />
          </div>
          <div className="dashboard-card">
            <Skeleton className="h-[240px] w-full rounded-xl" />
          </div>
          <div className="dashboard-card">
            <Skeleton className="h-[240px] w-full rounded-xl" />
          </div>
        </div>
      </section>
    </div>
  );
}
