"use client";

import Link from "next/link";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";

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

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(lang === "es" ? "es-ES" : "en-US", {
      style: "currency",
      currency: "EUR",
    }).format(amount);

  const activeSubs = (subscriptions as Sub[]).filter(isSubActive);
  const inactiveSubs = (subscriptions as Sub[]).filter((s) => !isSubActive(s));
  activeSubs.sort((a, b) => Number(b.cost) - Number(a.cost));
  inactiveSubs.sort((a, b) => Number(b.cost) - Number(a.cost));
  const totalMonthly = calculateMonthly(activeSubs);

  const getFreqLabel = (freq: string, val: number) => {
    if (freq === "monthly") return val === 1 ? t("sub.monthly") : `${t("sub.every")} ${val} ${t("sub.months")}`;
    if (freq === "yearly") return val === 1 ? t("sub.yearly") : `${t("sub.every")} ${val} ${t("sub.years")}`;
    if (freq === "weekly") return val === 1 ? t("sub.weekly") : `${t("sub.every")} ${val} ${t("sub.weeks")}`;
    return freq;
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <header className="page-header">
          <h1 className="title">{t("nav.subscriptions")}</h1>
        </header>
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  return (
    <div className="page-container fade-in">
      <header className="page-header">
        <div>
          <div className="title-with-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="title-icon">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <h1 className="title">{t("nav.subscriptions")}</h1>
          </div>
          <p style={{ marginTop: 4, color: "var(--gris-claro)", fontSize: "0.9rem" }}>
            <span style={{ fontWeight: 700, color: "var(--accent)" }}>{formatCurrency(totalMonthly)}</span>
            <span> / {t("sub.month")}</span>
          </p>
        </div>
        <Link href="/subscriptions/new" className="add-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>{t("sub.new")}</span>
        </Link>
      </header>
      <div className="subs-list">
        {activeSubs.length === 0 && inactiveSubs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <p>No subscriptions found</p>
            <Link href="/subscriptions/new" className="add-btn">{t("sub.new")}</Link>
          </div>
        ) : (
          <>
            {activeSubs.map((sub) => (
              <Link href={`/subscription/${sub.id}`} key={sub.id} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="sub-card">
                  <img src={sub.icon} alt="" className="sub-icon" />
                  <div className="sub-info">
                    <div className="sub-name">{sub.service_name}</div>
                    <div className="sub-meta">{getFreqLabel(sub.frequency, sub.frequency_value || 1)}</div>
                  </div>
                  <div className="sub-cost">{formatCurrency(Number(sub.cost))}</div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </Link>
            ))}
            {inactiveSubs.length > 0 && (
              <>
                <h3 style={{ marginTop: 24, marginBottom: 8, color: "var(--gris-claro)", fontSize: "0.9rem" }}>
                  {t("sub.inactive")}
                </h3>
                {inactiveSubs.map((sub) => (
                  <Link href={`/subscription/${sub.id}`} key={sub.id} style={{ textDecoration: "none", color: "inherit" }}>
                    <div className="sub-card inactive">
                      <img src={sub.icon} alt="" className="sub-icon" />
                      <div className="sub-info">
                        <div className="sub-name">{sub.service_name}</div>
                        <div className="sub-meta">{t("sub.cancelled")}</div>
                      </div>
                      <div className="sub-cost">{formatCurrency(Number(sub.cost))}</div>
                    </div>
                  </Link>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
