"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { useUpdateSubscription, useDeleteSubscription } from "@/hooks/useSubscriptionMutations";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { SwipeToReveal, SwipeToRevealGroup } from "@/components/SwipeToReveal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Pencil, XCircle, Trash2 } from "lucide-react";
import { toDateString } from "@/lib/date";
import { useState, memo } from "react";

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

type SubscriptionCardContentProps = {
  sub: Sub;
  isActive: boolean;
  freqLabel: string;
  activeLabel: string;
  inactiveLabel: string;
  formattedCost: string;
};

const SubscriptionCardContent = memo(function SubscriptionCardContent({
  sub,
  isActive,
  freqLabel,
  activeLabel,
  inactiveLabel,
  formattedCost,
}: SubscriptionCardContentProps) {
  return (
    <Link href={`/subscription/${sub.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <div className={`subs-card ${isActive ? "active" : "inactive"}`}>
        <div className="subs-card-icon">
          <img src={sub.icon || "/placeholder-icon.png"} alt="" />
        </div>
        <div className="subs-card-content">
          <span className="subs-card-name">{sub.service_name}</span>
          <div className="subs-card-badges">
            <span className="subs-badge subs-badge-freq">{freqLabel}</span>
            <span className={`subs-badge ${isActive ? "subs-badge-active" : "subs-badge-inactive"}`}>
              {isActive ? activeLabel : inactiveLabel}
            </span>
          </div>
          <span className="subs-card-cost">{formattedCost}</span>
        </div>
        {isActive && (
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
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { data: subscriptions = [], isLoading } = useSubscriptions();
  const updateSub = useUpdateSubscription();
  const deleteSub = useDeleteSubscription();
  const [inactiveOpen, setInactiveOpen] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [subToDelete, setSubToDelete] = useState<Sub | null>(null);
  const [subToCancel, setSubToCancel] = useState<Sub | null>(null);

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

  const handleDelete = async () => {
    if (!subToDelete) return;
    await deleteSub.mutateAsync(subToDelete.id);
    setShowDelete(false);
    setSubToDelete(null);
    router.push("/subscriptions");
  };

  const handleCancel = async () => {
    if (!subToCancel) return;
    const today = toDateString(new Date());
    await updateSub.mutateAsync({ id: subToCancel.id, end_date: today });
    setShowCancel(false);
    setSubToCancel(null);
    router.refresh();
  };

  const renderSubCard = (sub: Sub, isActive: boolean) => {
    const canCancel = isActive && !sub.end_date;
    const cardContent = (
      <SubscriptionCardContent
        sub={sub}
        isActive={isActive}
        freqLabel={getFreqLabel(sub.frequency, sub.frequency_value || 1)}
        activeLabel={t("sub.active")}
        inactiveLabel={t("sub.inactive")}
        formattedCost={formatCurrency(Number(sub.cost))}
      />
    );

    if (!isMobile) {
      return <div key={sub.id}>{cardContent}</div>;
    }

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
            {canCancel && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSubToCancel(sub);
                  setShowCancel(true);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--warning)] transition-colors hover:bg-[var(--warning-soft)]"
                aria-label={t("sub.cancel")}
              >
                <XCircle className="size-5" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSubToDelete(sub);
                setShowDelete(true);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)]"
              aria-label={t("sub.delete")}
            >
              <Trash2 className="size-5" />
            </button>
          </div>
        }
      >
        {cardContent}
      </SwipeToReveal>
    );
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
                <span className="subs-section-count">{activeSubs.length}</span>
              </div>
              {isMobile ? (
                <SwipeToRevealGroup className="subs-list">
                  {activeSubs.map((sub) => renderSubCard(sub, true))}
                </SwipeToRevealGroup>
              ) : (
                <div className="subs-list">
                  {activeSubs.map((sub) => renderSubCard(sub, true))}
                </div>
              )}
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
                  {isMobile ? (
                    <SwipeToRevealGroup className="subs-list">
                      {inactiveSubs.map((sub) => renderSubCard(sub, false))}
                    </SwipeToRevealGroup>
                  ) : (
                    <div className="subs-list">
                      {inactiveSubs.map((sub) => renderSubCard(sub, false))}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancel} onOpenChange={(open) => { setShowCancel(open); if (!open) setSubToCancel(null); }}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader className="items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--warning-soft)]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" />
              </svg>
            </div>
            <DialogTitle className="text-center">
              {lang === "es" ? "¿Cancelar suscripción?" : "Cancel subscription?"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {subToCancel && (
                lang === "es"
                  ? `Se establecerá la fecha de fin de ${subToCancel.service_name} como hoy.`
                  : `This will set ${subToCancel.service_name}'s end date to today.`
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-3 pt-2">
            <Button variant="outline" onClick={() => { setShowCancel(false); setSubToCancel(null); }}>
              {t("sub.cancelAction")}
            </Button>
            <Button
              variant="default"
              onClick={handleCancel}
              disabled={updateSub.isPending}
              className="bg-[var(--warning)] hover:bg-[var(--warning-hover)] text-black"
            >
              {updateSub.isPending && <Spinner className="size-4" />}
              {t("sub.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDelete} onOpenChange={(open) => { setShowDelete(open); if (!open) setSubToDelete(null); }}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader className="items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--danger-soft)]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <DialogTitle className="text-center">{t("sub.deleteTitle")}</DialogTitle>
            <DialogDescription className="text-center">
              {t("sub.deleteConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-3 pt-2">
            <Button variant="outline" onClick={() => { setShowDelete(false); setSubToDelete(null); }}>
              {t("sub.cancelAction")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteSub.isPending}
            >
              {deleteSub.isPending && <Spinner className="size-4" />}
              {t("sub.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
