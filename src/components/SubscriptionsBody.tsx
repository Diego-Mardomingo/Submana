"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { SubscriptionDialogs, useFrequencyLabel, type SubscriptionAction } from "@/components/SubscriptionDialogs";
import { SwipeToReveal, SwipeToRevealGroup } from "@/components/SwipeToReveal";
import { AddButton } from "@/components/ui/add-button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useSubscriptions, type Subscription } from "@/hooks/useSubscriptions";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { isSubscriptionActive, monthlyCost } from "@/lib/subscriptions";

const CalendarIcon = ({ size, strokeWidth = 2.5, lines }: { size?: number; strokeWidth?: number; lines?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    {lines && (
      <>
        <line x1="9" y1="14" x2="15" y2="14" />
        <line x1="9" y1="18" x2="15" y2="18" />
      </>
    )}
  </svg>
);

const SubscriptionCard = memo(function SubscriptionCard({ sub, active, freqLabel, statusLabel }: {
  sub: Subscription;
  active: boolean;
  freqLabel: string;
  statusLabel: string;
}) {
  return (
    <Link href={`/subscription/${sub.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <div className={`subs-card ${active ? "active" : "inactive"}`}>
        <div className="subs-card-icon">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote service logos */}
          {sub.icon && <img src={sub.icon} alt="" />}
        </div>
        <div className="subs-card-content">
          <span className="subs-card-name">{sub.service_name}</span>
          <div className="subs-card-badges">
            <span className="subs-badge subs-badge-freq">{freqLabel}</span>
            <span className={`subs-badge ${active ? "subs-badge-active" : "subs-badge-inactive"}`}>{statusLabel}</span>
          </div>
          <span className="subs-card-cost">
            <SensitiveAmount>{formatCurrency(Number(sub.cost))}</SensitiveAmount>
          </span>
        </div>
        {active && (
          <svg className="subs-card-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        )}
      </div>
    </Link>
  );
});

export default function SubscriptionsBody() {
  const lang = useLang();
  const t = useTranslations(lang);
  const es = lang === "es";
  const isMobile = useMediaQuery("(max-width: 767px)");
  const freqLabel = useFrequencyLabel();
  const { data: subscriptions = [], isLoading } = useSubscriptions();
  const [inactiveOpen, setInactiveOpen] = useState(false);
  const [action, setAction] = useState<SubscriptionAction>(null);

  const byCost = [...subscriptions].sort((a, b) => Number(b.cost) - Number(a.cost));
  const activeSubs = byCost.filter(isSubscriptionActive);
  const inactiveSubs = byCost.filter((s) => !isSubscriptionActive(s));
  const totalMonthly = activeSubs.reduce((sum, sub) => sum + monthlyCost(sub), 0);

  const renderList = (subs: Subscription[], active: boolean) => {
    const cards = subs.map((sub) => {
      const card = <SubscriptionCard sub={sub} active={active} freqLabel={freqLabel(sub)} statusLabel={t(active ? "sub.active" : "sub.inactive")} />;
      if (!isMobile) return <div key={sub.id}>{card}</div>;
      const button = (type: "cancel" | "delete", className: string, label: string, icon: React.ReactNode) => (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setAction({ type, sub });
          }}
          className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${className}`}
          aria-label={label}
        >
          {icon}
        </button>
      );
      return (
        <SwipeToReveal
          key={sub.id}
          id={sub.id}
          className="subs-swipe-wrapper"
          swipeHint
          desktopMinWidth={768}
          actions={
            <div className="flex items-center gap-2">
              <Link
                href={`/subscription/${sub.id}/edit`}
                onClick={(e) => e.stopPropagation()}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)]"
                aria-label={t("sub.edit")}
              >
                <Pencil className="size-5" />
              </Link>
              {active &&
                !sub.end_date &&
                button("cancel", "text-[var(--warning)] hover:bg-[var(--warning-soft)]", t("sub.cancel"), <XCircle className="size-5" />)}
              {button("delete", "text-[var(--danger)] hover:bg-[var(--danger-soft)]", t("sub.delete"), <Trash2 className="size-5" />)}
            </div>
          }
        >
          {card}
        </SwipeToReveal>
      );
    });
    return isMobile ? <SwipeToRevealGroup className="subs-list">{cards}</SwipeToRevealGroup> : <div className="subs-list">{cards}</div>;
  };

  const header = (
    <PageHeader icon={<CalendarIcon />} title={t("nav.subscriptions")} subtitle={t("sub.heroSubtitle")}>
      {!isLoading && <AddButton href="/subscriptions/new">{t("sub.new")}</AddButton>}
    </PageHeader>
  );

  if (isLoading) {
    return (
      <div className="page-container">
        {header}
        <div className="info-stats-row">
          <div className="skeleton" style={{ height: 90, borderRadius: 18, flex: 1 }} />
          <div className="skeleton" style={{ height: 90, borderRadius: 18, flex: 1 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 80, borderRadius: 14 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container fade-in">
      {header}

      {subscriptions.length === 0 ? (
        <div className="subs-empty">
          <div className="subs-empty-icon">
            <CalendarIcon size={40} strokeWidth={1.5} lines />
          </div>
          <p className="subs-empty-title">{es ? "Sin suscripciones" : "No subscriptions yet"}</p>
          <p className="subs-empty-text">
            {es ? "Añade tus suscripciones para controlar tus gastos recurrentes" : "Add your subscriptions to track your recurring expenses"}
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
          <div className="info-stats-row">
            {(
              [
                ["sub.monthlyCost", totalMonthly, <path key="a" d="M2 17a5 5 0 0 0 10 0c0-2.76-2.24-5-5-5s-5 2.24-5 5ZM12 17a5 5 0 0 0 10 0c0-2.76-2.24-5-5-5s-5 2.24-5 5ZM7 7a5 5 0 0 0 10 0c0-2.76-2.24-5-5-5S7 4.24 7 7Z" />],
                ["sub.annualCost", totalMonthly * 12, <path key="b" d="M3 3v18h18M19 9l-5 5-4-4-3 3" />],
              ] as const
            ).map(([label, value, icon]) => (
              <div key={label} className="info-stat-card">
                <div className="info-stat-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {icon}
                  </svg>
                </div>
                <div className="info-stat-content">
                  <span className="info-stat-label">{t(label)}</span>
                  <span className="info-stat-value">
                    <SensitiveAmount>{formatCurrency(value)}</SensitiveAmount>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {activeSubs.length > 0 && (
            <section className="subs-section">
              <div className="subs-section-header">
                <span className="subs-section-title">{t("sub.active")}</span>
                <span className="subs-section-count">{activeSubs.length}</span>
              </div>
              {renderList(activeSubs, true)}
            </section>
          )}

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
                  {renderList(inactiveSubs, false)}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}

      <SubscriptionDialogs action={action} onClose={() => setAction(null)} />
    </div>
  );
}

