"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SquarePen, Trash2, XCircle } from "lucide-react";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { SubscriptionDialogs, useFrequencyLabel, type SubscriptionAction } from "@/components/SubscriptionDialogs";
import { useAccounts } from "@/hooks/useAccounts";
import { useLang } from "@/hooks/useLang";
import type { Subscription } from "@/hooks/useSubscriptions";
import { parseDateString } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { initialsAvatarDataUri } from "@/lib/initialsAvatar";
import { isSubscriptionActive, nextPaymentDate, totalSpent } from "@/lib/subscriptions";

/** DD-MM-YYYY */
const formatDay = (date: Date) =>
  [date.getDate(), date.getMonth() + 1].map((n) => String(n).padStart(2, "0")).join("-") + `-${date.getFullYear()}`;

export default function SubscriptionDetail({ sub }: { sub: Subscription }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const es = lang === "es";
  const router = useRouter();
  const freqLabel = useFrequencyLabel();
  const { data: accounts = [] } = useAccounts();
  const [action, setAction] = useState<SubscriptionAction>(null);

  const account = accounts.find((a) => a.id === sub.account_id);
  const active = isSubscriptionActive(sub);
  const nextPayment = nextPaymentDate(sub);
  const muted = { color: "var(--gris-claro)" };

  const cards: [string, React.ReactNode, React.CSSProperties?][] = [
    [t("sub.startDate"), formatDay(parseDateString(sub.start_date))],
    [t("sub.endDate"), sub.end_date ? formatDay(parseDateString(sub.end_date)) : es ? "Sin fecha" : "No end date"],
    [t("sub.nextPayment"), nextPayment ? formatDay(nextPayment) : "-", nextPayment ? { color: "var(--accent)" } : muted],
    [t("sub.totalSpent"), <SensitiveAmount key="spent">{formatCurrency(totalSpent(sub))}</SensitiveAmount>, { color: "var(--accent)" }],
    [
      t("sub.account"),
      account ? (
        <>
          <span className="subs-detail-account-dot" style={{ backgroundColor: account.color || "var(--accent)" }} />
          {account.name}
        </>
      ) : (
        <span style={muted}>{es ? "Sin cuenta" : "No account"}</span>
      ),
      { display: "flex", alignItems: "center", gap: 8 },
    ],
  ];

  return (
    <>
      <div className="subs-detail fade-in">
        <div className="subs-detail-header">
          <div className="subs-detail-icon">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote service logos */}
            <img src={sub.icon || initialsAvatarDataUri(sub.service_name)} alt={sub.service_name} />
          </div>
          <h1 className="subs-detail-name">{sub.service_name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="subs-detail-cost">
              <SensitiveAmount>{formatCurrency(Number(sub.cost))}</SensitiveAmount>
            </span>
            <span className="subs-detail-freq">/ {freqLabel(sub)}</span>
          </div>
          <span className={`subs-badge ${active ? "subs-badge-active" : "subs-badge-inactive"}`}>{t(active ? "sub.active" : "sub.inactive")}</span>
        </div>

        <div className="subs-detail-grid">
          {cards.map(([label, value, style]) => (
            <div key={label} className="subs-detail-card">
              <span className="subs-detail-card-label">{label}</span>
              <span className="subs-detail-card-value" style={style}>
                {value}
              </span>
            </div>
          ))}
        </div>

        <div className="subs-detail-actions">
          <Link href={`/subscription/${sub.id}/edit`} className="btn-edit">
            <SquarePen className="size-[18px]" />
            {t("sub.edit")}
          </Link>
          {active && !sub.end_date && (
            <button type="button" className="btn-cancel-sub" onClick={() => setAction({ type: "cancel", sub })}>
              <XCircle className="size-[18px]" />
              {t("sub.cancel")}
            </button>
          )}
          <button type="button" className="btn-delete" onClick={() => setAction({ type: "delete", sub })}>
            <Trash2 className="size-[18px]" />
            {t("sub.delete")}
          </button>
        </div>
      </div>

      <SubscriptionDialogs
        action={action}
        onClose={() => setAction(null)}
        onDone={(type) => (type === "delete" ? router.push("/subscriptions") : router.refresh())}
      />
    </>
  );
}
