"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import BalanceHero from "@/components/dashboard/BalanceHero";
import MonthOverview from "@/components/dashboard/MonthOverview";
import { IncomeExpenseCard, SavingsProjectionCard } from "@/components/dashboard/Trends";
import { useLang } from "@/hooks/useLang";
import { prefetchMonth } from "@/hooks/useTransactions";
import { appNow, shiftMonth } from "@/lib/date";
import { localeOf } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";

export default function DashboardPage() {
  const lang = useLang();
  const t = useTranslations(lang);
  const queryClient = useQueryClient();

  // Warm the caches for the month switcher (current month ± 2).
  useEffect(() => {
    const now = appNow();
    for (let delta = -2; delta <= 2; delta++) {
      const { year, month } = shiftMonth(now.getFullYear(), now.getMonth() + 1, delta);
      prefetchMonth(queryClient, year, month, delta === 0 ? 5 * 60 * 1000 : 15 * 60 * 1000);
    }
  }, [queryClient]);

  const today = appNow().toLocaleDateString(localeOf(lang), { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="page-container lp-page dash-page fade-in">
      <header className="lp-header dash-header">
        <h1>{t("nav.dashboard")}</h1>
        <span className="dash-date">{today}</span>
      </header>

      <div className="dash-layout">
        <BalanceHero />
        <MonthOverview />
        <section className="dash-section" aria-label={lang === "es" ? "Tendencias" : "Trends"}>
          <div className="lp-section-head">
            <span className="lp-section-title">{lang === "es" ? "Tendencias" : "Trends"}</span>
          </div>
          <div className="dash-trends">
            <IncomeExpenseCard lang={lang} />
            <SavingsProjectionCard lang={lang} />
          </div>
        </section>
      </div>
    </div>
  );
}
