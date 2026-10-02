"use client";

import { memo, useCallback, useState } from "react";
import { ChevronDown, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { CompactPageHeader } from "@/components/PageHeader";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { SubscriptionDialogs, useFrequencyLabel, type SubscriptionAction } from "@/components/SubscriptionDialogs";
import { SubscriptionSheet } from "@/components/SubscriptionSheet";
import { SwipeToReveal, SwipeToRevealGroup } from "@/components/SwipeToReveal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCreateDialog } from "@/hooks/useCreateDialog";
import { useLang } from "@/hooks/useLang";
import { useSubscriptions, type Subscription } from "@/hooks/useSubscriptions";
import { parseDateString } from "@/lib/date";
import { formatCurrency, localeOf } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { initialsAvatarDataUri } from "@/lib/initialsAvatar";
import { isSubscriptionActive, monthlyCost, nextPaymentDate } from "@/lib/subscriptions";

const CalendarIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const DAY_MS = 86_400_000;
const daysFromToday = (date: Date) => {
  const now = new Date();
  return Math.round((date.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime()) / DAY_MS);
};

/** "Hoy", "Mañana", "En 5 días" for the coming week, otherwise "14 mar" (plus the year when it differs). */
function useDateLabels() {
  const lang = useLang();
  const es = lang === "es";
  const short = (date: Date) =>
    date.toLocaleDateString(localeOf(lang), {
      day: "numeric",
      month: "short",
      ...(date.getFullYear() !== new Date().getFullYear() && { year: "numeric" }),
    });
  const relative = (date: Date) => {
    const days = daysFromToday(date);
    if (days === 0) return es ? "Hoy" : "Today";
    if (days === 1) return es ? "Mañana" : "Tomorrow";
    if (days > 1 && days <= 7) return es ? `En ${days} días` : `In ${days} days`;
    return short(date);
  };
  return { short, relative };
}

const SubscriptionIcon = ({ sub }: { sub: Subscription }) => (
  <span className="lp-icon" aria-hidden>
    {/* eslint-disable-next-line @next/next/no-img-element -- remote service logos */}
    <img src={sub.icon || initialsAvatarDataUri(sub.service_name)} alt="" />
  </span>
);

const SubscriptionRow = memo(function SubscriptionRow({ sub, active, meta, perMonth, onOpen }: {
  sub: Subscription;
  active: boolean;
  meta: React.ReactNode;
  perMonth?: string;
  onOpen: (sub: Subscription) => void;
}) {
  return (
    <button type="button" className={`lp-row ${active ? "" : "lp-row--dim"}`} onClick={() => onOpen(sub)}>
      <SubscriptionIcon sub={sub} />
      <span className="lp-main">
        <span className="lp-title">
          <span>{sub.service_name}</span>
        </span>
        <span className="lp-meta">{meta}</span>
      </span>
      <span className="lp-end">
        <span className="lp-amount">
          <SensitiveAmount>{formatCurrency(Number(sub.cost))}</SensitiveAmount>
        </span>
        {perMonth && <span className="lp-sub-amount">{perMonth}</span>}
      </span>
    </button>
  );
});

export default function SubscriptionsBody() {
  const lang = useLang();
  const t = useTranslations(lang);
  const es = lang === "es";
  const freqLabel = useFrequencyLabel();
  const dates = useDateLabels();
  const { data: subscriptions = [], isLoading } = useSubscriptions();
  const [inactiveOpen, setInactiveOpen] = useState(false);
  const [action, setAction] = useState<SubscriptionAction>(null);
  const [createOpen, setCreateOpen] = useCreateDialog();
  const [sheet, setSheet] = useState<{ sub: Subscription; mode: "view" | "edit" } | null>(null);
  const openSub = useCallback((sub: Subscription) => setSheet({ sub, mode: "view" }), []);
  // Live data for the open subscription (falls back to the snapshot once deleted).
  const sheetSub = sheet ? (subscriptions.find((s) => s.id === sheet.sub.id) ?? sheet.sub) : null;

  const next = new Map(subscriptions.map((sub) => [sub.id, nextPaymentDate(sub)]));
  const nextTime = (sub: Subscription) => next.get(sub.id)?.getTime() ?? Infinity;
  const activeSubs = subscriptions
    .filter(isSubscriptionActive)
    .sort((a, b) => nextTime(a) - nextTime(b) || Number(b.cost) - Number(a.cost));
  const inactiveSubs = subscriptions.filter((s) => !isSubscriptionActive(s)).sort((a, b) => Number(b.cost) - Number(a.cost));
  const totalMonthly = activeSubs.reduce((sum, sub) => sum + monthlyCost(sub), 0);
  const upcoming = activeSubs.find((sub) => next.get(sub.id));

  const perMonthLabel = (sub: Subscription) =>
    sub.frequency === "monthly" && (sub.frequency_value || 1) === 1 ? undefined : `≈ ${formatCurrency(monthlyCost(sub))}/${es ? "mes" : "mo"}`;

  const activeMeta = (sub: Subscription) => {
    const date = next.get(sub.id);
    const soon = date && daysFromToday(date) <= 3;
    return (
      <>
        <span className={soon ? "lp-soon" : undefined}>{date ? dates.relative(date) : es ? "Sin más cobros" : "No more charges"}</span>
        <span className="lp-meta-sep">·</span>
        {sub.end_date ? (
          <span className="lp-warn lp-truncate">
            {es ? "Termina" : "Ends"} {dates.short(parseDateString(sub.end_date))}
          </span>
        ) : (
          <span className="lp-truncate">{freqLabel(sub)}</span>
        )}
      </>
    );
  };

  const inactiveMeta = (sub: Subscription) => {
    const upcomingStart = parseDateString(sub.start_date) > new Date();
    const date = upcomingStart ? sub.start_date : sub.end_date;
    return (
      <>
        {date && (
          <>
            <span>
              {upcomingStart ? (es ? "Empieza" : "Starts") : es ? "Finalizó" : "Ended"} {dates.short(parseDateString(date))}
            </span>
            <span className="lp-meta-sep">·</span>
          </>
        )}
        <span className="lp-truncate">{freqLabel(sub)}</span>
      </>
    );
  };

  const renderList = (subs: Subscription[], active: boolean) => (
    <SwipeToRevealGroup className="lp-card lp-group">
      {subs.map((sub) => {
        const button = (type: "cancel" | "delete", className: string, label: string, icon: React.ReactNode) => (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAction({ type, sub });
            }}
            className={`lp-action ${className}`}
            aria-label={label}
          >
            {icon}
          </button>
        );
        return (
          <SwipeToReveal
            key={sub.id}
            id={sub.id}
            className="lp-swipe lp-swipe--3"
            desktopMinWidth={1024}
            actions={
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSheet({ sub, mode: "edit" });
                  }}
                  className="lp-action lp-action--edit"
                  aria-label={t("sub.edit")}
                >
                  <Pencil className="size-5" />
                </button>
                {active && !sub.end_date && button("cancel", "lp-action--warn", t("sub.cancel"), <XCircle className="size-5" />)}
                {button("delete", "lp-action--danger", t("sub.delete"), <Trash2 className="size-5" />)}
              </>
            }
          >
            <SubscriptionRow sub={sub} active={active} meta={active ? activeMeta(sub) : inactiveMeta(sub)} perMonth={perMonthLabel(sub)} onOpen={openSub} />
          </SwipeToReveal>
        );
      })}
    </SwipeToRevealGroup>
  );

  const header = <CompactPageHeader title={t("nav.subscriptions")} addLabel={t("sub.new")} onAdd={() => setCreateOpen(true)} />;
  const sheets = (
    <SubscriptionSheet
      open={createOpen || !!sheet}
      onOpenChange={(open) => {
        if (open) return;
        setCreateOpen(false);
        setSheet(null);
      }}
      subscription={sheetSub}
      mode={sheet?.mode}
    />
  );

  if (isLoading) {
    return (
      <div className="page-container lp-page">
        {header}
        <div className="lp-layout">
          <div className="lp-aside">
            <div className="skeleton" style={{ height: 128, borderRadius: 16 }} />
          </div>
          <div className="lp-content">
            <div className="skeleton" style={{ height: 4 * 57, borderRadius: 16 }} />
          </div>
        </div>
      </div>
    );
  }

  const upcomingDate = upcoming && next.get(upcoming.id);
  return (
    <div className="page-container lp-page fade-in">
      {header}

      {subscriptions.length === 0 ? (
        <div className="lp-card lp-empty">
          <div className="lp-empty-icon">
            <CalendarIcon />
          </div>
          <p className="lp-empty-title">{es ? "Sin suscripciones" : "No subscriptions yet"}</p>
          <p className="lp-empty-text">
            {es ? "Añade tus suscripciones para controlar tus gastos recurrentes" : "Add your subscriptions to track your recurring expenses"}
          </p>
          <button type="button" className="lp-chip" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" strokeWidth={2.5} />
            {t("sub.new")}
          </button>
        </div>
      ) : (
        <div className="lp-layout">
          <aside className="lp-aside">
            <div className="lp-card lp-summary">
              <div className="lp-stats">
                <div className="lp-stat">
                  <span className="lp-label">{es ? "Al mes" : "Monthly"}</span>
                  <span className="lp-stat-value">
                    <SensitiveAmount>{formatCurrency(totalMonthly)}</SensitiveAmount>
                  </span>
                </div>
                <div className="lp-stat">
                  <span className="lp-label">{es ? "Al año" : "Yearly"}</span>
                  <span className="lp-stat-value">
                    <SensitiveAmount>{formatCurrency(totalMonthly * 12)}</SensitiveAmount>
                  </span>
                </div>
                <div className="lp-stat">
                  <span className="lp-label">{es ? "Activas" : "Active"}</span>
                  <span className="lp-stat-value">{activeSubs.length}</span>
                </div>
              </div>
              {upcoming && upcomingDate && (
                <>
                  <div className="lp-summary-divider" />
                  <button type="button" className="lp-next" onClick={() => openSub(upcoming)}>
                    <SubscriptionIcon sub={upcoming} />
                    <span className="lp-next-text">
                      <span className="lp-label">{t("sub.nextPayment")}</span>
                      <strong>
                        {upcoming.service_name} · <span className="lp-soon">{dates.relative(upcomingDate)}</span>
                      </strong>
                    </span>
                    <span className="lp-amount">
                      <SensitiveAmount>{formatCurrency(Number(upcoming.cost))}</SensitiveAmount>
                    </span>
                  </button>
                </>
              )}
            </div>
          </aside>

          <div className="lp-content">
            {activeSubs.length > 0 && (
              <section className="lp-section">
                <div className="lp-section-head">
                  <span className="lp-section-title">
                    {es ? "Activas" : "Active"} · {activeSubs.length}
                  </span>
                  <span className="lp-section-aside">{es ? "Por próximo cobro" : "By next charge"}</span>
                </div>
                {renderList(activeSubs, true)}
              </section>
            )}

            {inactiveSubs.length > 0 && (
              <Collapsible open={inactiveOpen} onOpenChange={setInactiveOpen} className="lp-section">
                <CollapsibleTrigger className="lp-collapse-trigger">
                  <span>
                    {es ? "Inactivas" : "Inactive"} · {inactiveSubs.length}
                  </span>
                  <ChevronDown className="size-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="subs-collapsible-content">
                  <div className="subs-collapsible-inner">{renderList(inactiveSubs, false)}</div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>
      )}

      <SubscriptionDialogs action={action} onClose={() => setAction(null)} />
      {sheets}
    </div>
  );
}
