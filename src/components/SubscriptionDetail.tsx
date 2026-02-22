"use client";

import Link from "next/link";
import { useState } from "react";
import { useDeleteSubscription, useUpdateSubscription } from "@/hooks/useSubscriptionMutations";
import { useAccounts } from "@/hooks/useAccounts";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { useRouter } from "next/navigation";
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

interface Account {
  id: string;
  name: string;
  color?: string;
}

interface Sub {
  id: string;
  service_name: string;
  icon?: string;
  cost: number;
  start_date: string;
  end_date?: string | null;
  frequency: string;
  frequency_value: number;
  account_id?: string | null;
}

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

function getNextPaymentDate(sub: Sub): Date | null {
  const today = setToNoon(new Date());
  const start = setToNoon(new Date(sub.start_date));
  
  if (start > today) return start;
  if (sub.end_date) {
    const end = setToNoon(new Date(sub.end_date));
    if (end < today) return null;
  }

  const freqVal = sub.frequency_value || 1;
  let nextDate = new Date(start);

  while (nextDate <= today) {
    if (sub.frequency === "weekly") {
      nextDate.setDate(nextDate.getDate() + 7 * freqVal);
    } else if (sub.frequency === "monthly") {
      nextDate.setMonth(nextDate.getMonth() + freqVal);
    } else if (sub.frequency === "yearly") {
      nextDate.setFullYear(nextDate.getFullYear() + freqVal);
    } else {
      break;
    }
  }

  if (sub.end_date) {
    const end = setToNoon(new Date(sub.end_date));
    if (nextDate > end) return null;
  }

  return nextDate;
}

function calculateTotalSpent(sub: Sub): number {
  const today = setToNoon(new Date());
  const start = setToNoon(new Date(sub.start_date));
  const end = sub.end_date ? setToNoon(new Date(sub.end_date)) : today;
  
  if (start > today) return 0;
  
  const effectiveEnd = end < today ? end : today;
  const cost = Number(sub.cost);
  const freqVal = sub.frequency_value || 1;
  
  let paymentCount = 0;
  let currentDate = new Date(start);
  
  while (currentDate <= effectiveEnd) {
    paymentCount++;
    
    if (sub.frequency === "weekly") {
      currentDate.setDate(currentDate.getDate() + 7 * freqVal);
    } else if (sub.frequency === "monthly") {
      currentDate.setMonth(currentDate.getMonth() + freqVal);
    } else if (sub.frequency === "yearly") {
      currentDate.setFullYear(currentDate.getFullYear() + freqVal);
    } else {
      break;
    }
  }
  
  return cost * paymentCount;
}

export default function SubscriptionDetail({ sub }: { sub: Sub }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const router = useRouter();
  const [showDelete, setShowDelete] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const deleteSub = useDeleteSubscription();
  const updateSub = useUpdateSubscription();
  const { data: accounts = [] } = useAccounts();
  
  const linkedAccount = sub.account_id 
    ? (accounts as Account[]).find((a) => a.id === sub.account_id) 
    : null;

  const formatCurrency = (n: number) => {
    const formatted = new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    }).format(n);
    return `${formatted} €`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatDateShort = (date: Date) => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const handleDelete = async () => {
    await deleteSub.mutateAsync(sub.id);
    router.push("/subscriptions");
  };

  const handleCancel = async () => {
    const today = new Date().toISOString().slice(0, 10);
    await updateSub.mutateAsync({
      id: sub.id,
      end_date: today,
    });
    setShowCancel(false);
    router.refresh();
  };

  const active = isSubActive(sub);
  const nextPayment = getNextPaymentDate(sub);
  const totalSpent = calculateTotalSpent(sub);
  const canCancel = active && !sub.end_date;
  
  const getFreqLabel = (freq: string, val: number) => {
    if (freq === "monthly") return val === 1 ? t("sub.monthly") : `${t("sub.every")} ${val} ${t("sub.months")}`;
    if (freq === "yearly") return val === 1 ? t("sub.yearly") : `${t("sub.every")} ${val} ${t("sub.years")}`;
    if (freq === "weekly") return val === 1 ? t("sub.weekly") : `${t("sub.every")} ${val} ${t("sub.weeks")}`;
    return freq;
  };

  return (
    <>
      <div className="subs-detail fade-in">
        {/* Header with Icon and Name */}
        <div className="subs-detail-header">
          <div className="subs-detail-icon">
            <img src={sub.icon || "/placeholder-icon.png"} alt={sub.service_name} />
          </div>
          <h1 className="subs-detail-name">{sub.service_name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="subs-detail-cost">{formatCurrency(Number(sub.cost))}</span>
            <span className="subs-detail-freq">/ {getFreqLabel(sub.frequency, sub.frequency_value || 1)}</span>
          </div>
          <span className={`subs-badge ${active ? "subs-badge-active" : "subs-badge-inactive"}`}>
            {active ? t("sub.active") : t("sub.inactive")}
          </span>
        </div>

        {/* Info Grid */}
        <div className="subs-detail-grid">
          <div className="subs-detail-card">
            <span className="subs-detail-card-label">{t("sub.startDate")}</span>
            <span className="subs-detail-card-value">{formatDate(sub.start_date)}</span>
          </div>
          <div className="subs-detail-card">
            <span className="subs-detail-card-label">{t("sub.endDate")}</span>
            <span className="subs-detail-card-value">
              {sub.end_date ? formatDate(sub.end_date) : (lang === "es" ? "Sin fecha" : "No end date")}
            </span>
          </div>
          <div className="subs-detail-card">
            <span className="subs-detail-card-label">{t("sub.nextPayment")}</span>
            <span className="subs-detail-card-value" style={{ color: nextPayment ? "var(--accent-light)" : "var(--gris-claro)" }}>
              {nextPayment ? formatDateShort(nextPayment) : "-"}
            </span>
          </div>
          <div className="subs-detail-card">
            <span className="subs-detail-card-label">{t("sub.totalSpent")}</span>
            <span className="subs-detail-card-value" style={{ color: "var(--accent-light)" }}>
              {formatCurrency(totalSpent)}
            </span>
          </div>
          <div className="subs-detail-card">
            <span className="subs-detail-card-label">{t("sub.account")}</span>
            <span className="subs-detail-card-value" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {linkedAccount ? (
                <>
                  <span
                    className="subs-detail-account-dot"
                    style={{ backgroundColor: linkedAccount.color || "var(--accent)" }}
                  />
                  {linkedAccount.name}
                </>
              ) : (
                <span style={{ color: "var(--gris-claro)" }}>
                  {lang === "es" ? "Sin cuenta" : "No account"}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="subs-detail-actions">
          <Link href={`/subscription/${sub.id}/edit`} className="btn-edit">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            {t("sub.edit")}
          </Link>
          {canCancel && (
            <button type="button" className="btn-cancel-sub" onClick={() => setShowCancel(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" />
              </svg>
              {t("sub.cancel")}
            </button>
          )}
          <button type="button" className="btn-delete" onClick={() => setShowDelete(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            {t("sub.delete")}
          </button>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancel} onOpenChange={setShowCancel}>
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
              {lang === "es" 
                ? `Se establecerá la fecha de fin de ${sub.service_name} como hoy.`
                : `This will set ${sub.service_name}'s end date to today.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowCancel(false)}>
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
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
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
            <Button variant="outline" onClick={() => setShowDelete(false)}>
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
    </>
  );
}
