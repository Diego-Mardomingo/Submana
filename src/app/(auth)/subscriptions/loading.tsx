"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";

function SubscriptionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export default function SubscriptionsLoading() {
  const lang = useLang();
  const t = useTranslations(lang);

  return (
    <div className="page-container fade-in">
      <header className="page-header-clean">
        <div className="page-header-left">
          <div className="page-header-icon">
            <SubscriptionsIcon />
          </div>
          <div className="page-header-text">
            <h1>{t("nav.subscriptions")}</h1>
            <p>{t("sub.heroSubtitle")}</p>
          </div>
        </div>
      </header>

      <div className="info-stats-row">
        <div className="skeleton" style={{ height: 90, borderRadius: 18, flex: 1 }} />
        <div className="skeleton" style={{ height: 90, borderRadius: 18, flex: 1 }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
        {[1, 2, 3, 4].map((i) => (
          <div className="skeleton" key={i} style={{ height: 80, borderRadius: 14 }} />
        ))}
      </div>
    </div>
  );
}
