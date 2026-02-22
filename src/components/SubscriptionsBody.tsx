"use client";

import Link from "next/link";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useState } from "react";

type Sub = {
  id: string;
  service_name: string;
  icon?: string;
  cost: number;
  start_date: string;
  end_date?: string | null;
  frequency: string;
  frequency_value: number;
};

function setToNoon(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
}

function isSubActive(sub: Sub) {
  const current = setToNoon(new Date());
  const start = setToNoon(new Date(sub.start_date));
  if (start > current) return false;
  if (sub.end_date) {
    const end = setToNoon(new Date(sub.end_date));
    if (end < current) return false;
  }
  return true;
}

function calculateMonthly(subs: Sub[]) {
  return subs.reduce((acc, sub) => {
    let monthly = Number(sub.cost);
    if (sub.frequency === "yearly") monthly /= 12;
    if (sub.frequency === "weekly") monthly *= 4;
    if ((sub.frequency_value || 1) > 1) monthly /= sub.frequency_value;
    return acc + monthly;
  }, 0);
}

export default function SubscriptionsBody() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: subscriptions = [], isLoading } = useSubscriptions();
  const [inactiveOpen, setInactiveOpen] = useState(false);

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    }).format(amount);
    return `${formatted} €`;
  };

  const activeSubs = (subscriptions as Sub[]).filter(isSubActive);
  const inactiveSubs = (subscriptions as Sub[]).filter((s) => !isSubActive(s));
  activeSubs.sort((a, b) => Number(b.cost) - Number(a.cost));
  inactiveSubs.sort((a, b) => Number(b.cost) - Number(a.cost));
  
  const totalMonthly = calculateMonthly(activeSubs);
  const totalYearly = totalMonthly * 12;

  const getFreqLabel = (freq: string, val: number) => {
    if (val === 1) {
      if (freq === "monthly") return t("sub.monthly");
      if (freq === "yearly") return t("sub.yearly");
      if (freq === "weekly") return t("sub.weekly");
    } else {
      if (freq === "monthly") return `${t("sub.every")} ${val} ${t("sub.months")}`;
      if (freq === "yearly") return `${t("sub.every")} ${val} ${t("sub.years")}`;
      if (freq === "weekly") return `${t("sub.every")} ${val} ${t("sub.weeks")}`;
    }
    return freq;
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <header className="page-header">
          <h1 className="title">{t("nav.subscriptions")}</h1>
        </header>
        <div className="skeleton" style={{ height: 120, borderRadius: 16 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
          <div className="skeleton" style={{ height: 80, borderRadius: 14 }} />
          <div className="skeleton" style={{ height: 80, borderRadius: 14 }} />
          <div className="skeleton" style={{ height: 80, borderRadius: 14 }} />
        </div>
      </div>
    );
  }

  const hasNoSubs = activeSubs.length === 0 && inactiveSubs.length === 0;

  return (
    <div className="page-container fade-in">
      {/* Page Header */}
      <header className="page-header-clean">
        <div className="page-header-left">
          <div className="page-header-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="page-header-text">
            <h1>{t("nav.subscriptions")}</h1>
            <p>{t("sub.heroSubtitle")}</p>
          </div>
        </div>
        <Link href="/subscriptions/new" className="add-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>{t("sub.new")}</span>
        </Link>
      </header>

      {/* Stats Cards */}
      {!hasNoSubs && (
        <div className="info-stats-row">
          <div className="info-stat-card">
            <div className="info-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 17a5 5 0 0 0 10 0c0-2.76-2.24-5-5-5s-5 2.24-5 5Z" />
                <path d="M12 17a5 5 0 0 0 10 0c0-2.76-2.24-5-5-5s-5 2.24-5 5Z" />
                <path d="M7 7a5 5 0 0 0 10 0c0-2.76-2.24-5-5-5S7 4.24 7 7Z" />
              </svg>
            </div>
            <div className="info-stat-content">
              <span className="info-stat-label">{t("sub.monthlyCost")}</span>
              <span className="info-stat-value">{formatCurrency(totalMonthly)}</span>
            </div>
          </div>
          <div className="info-stat-card">
            <div className="info-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
              </svg>
            </div>
            <div className="info-stat-content">
              <span className="info-stat-label">{t("sub.annualCost")}</span>
              <span className="info-stat-value">{formatCurrency(totalYearly)}</span>
            </div>
          </div>
        </div>
      )}

      {hasNoSubs ? (
        <div className="subs-empty">
          <div className="subs-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="9" y1="14" x2="15" y2="14" />
              <line x1="9" y1="18" x2="15" y2="18" />
            </svg>
          </div>
          <p className="subs-empty-title">
            {lang === "es" ? "Sin suscripciones" : "No subscriptions yet"}
          </p>
          <p className="subs-empty-text">
            {lang === "es" 
              ? "Añade tus suscripciones para controlar tus gastos recurrentes"
              : "Add your subscriptions to track your recurring expenses"
            }
          </p>
          <Link href="/subscriptions/new" className="subs-empty-cta">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t("sub.new")}
          </Link>
        </div>
      ) : (
        <>
          {/* Active Subscriptions */}
          {activeSubs.length > 0 && (
            <section className="subs-section">
              <div className="subs-section-header">
                <span className="subs-section-title">{t("sub.active")}</span>
              </div>
              <div className="subs-list">
                {activeSubs.map((sub) => (
                  <Link 
                    href={`/subscription/${sub.id}`} 
                    key={sub.id} 
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div className="subs-card active">
                      <div className="subs-card-icon">
                        <img src={sub.icon || "/placeholder-icon.png"} alt="" />
                      </div>
                      <div className="subs-card-content">
                        <span className="subs-card-name">{sub.service_name}</span>
                        <div className="subs-card-badges">
                          <span className="subs-badge subs-badge-freq">{getFreqLabel(sub.frequency, sub.frequency_value || 1)}</span>
                          <span className="subs-badge subs-badge-active">{t("sub.active")}</span>
                        </div>
                        <span className="subs-card-cost">{formatCurrency(Number(sub.cost))}</span>
                      </div>
                      <svg className="subs-card-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Inactive Subscriptions */}
          {inactiveSubs.length > 0 && (
            <Collapsible open={inactiveOpen} onOpenChange={setInactiveOpen}>
              <CollapsibleTrigger className="subs-collapsible-trigger">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{t("sub.inactive")}</span>
                  <span className="subs-section-count inactive">{inactiveSubs.length}</span>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </CollapsibleTrigger>
              <CollapsibleContent className="subs-collapsible-content">
                <div className="subs-collapsible-inner" style={{ paddingTop: 12 }}>
                  <div className="subs-list">
                    {inactiveSubs.map((sub) => (
                      <Link 
                        href={`/subscription/${sub.id}`} 
                        key={sub.id} 
                        style={{ textDecoration: "none", color: "inherit" }}
                      >
                        <div className="subs-card inactive">
                          <div className="subs-card-icon">
                            <img src={sub.icon || "/placeholder-icon.png"} alt="" />
                          </div>
                          <div className="subs-card-content">
                            <span className="subs-card-name">{sub.service_name}</span>
                            <div className="subs-card-badges">
                              <span className="subs-badge subs-badge-freq">{getFreqLabel(sub.frequency, sub.frequency_value || 1)}</span>
                              <span className="subs-badge subs-badge-inactive">{t("sub.inactive")}</span>
                            </div>
                            <span className="subs-card-cost">{formatCurrency(Number(sub.cost))}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}
    </div>
  );
}
