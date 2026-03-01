"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";

function TransactionsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2" />
      <path d="M15 7.8c-.523 -.502 -1.172 -.8 -1.875 -.8c-1.727 0 -3.125 1.791 -3.125 4s1.398 4 3.125 4c.703 0 1.352 -.298 1.874 -.8" />
      <path d="M9 11h4" />
    </svg>
  );
}

export default function TransactionsLoading() {
  const lang = useLang();
  const t = useTranslations(lang);

  return (
    <div className="page-container fade-in">
      <header className="page-header-clean">
        <div className="page-header-left">
          <div className="page-header-icon">
            <TransactionsIcon className="size-[26px]" />
          </div>
          <div className="page-header-text">
            <h1>{t("transactions.title")}</h1>
            <p>{t("transactions.heroSubtitle")}</p>
          </div>
        </div>
      </header>
      <div className="skeleton" style={{ height: 56, borderRadius: 12, marginBottom: 16 }} />
      <div className="tx-stats-panel">
        <div className="info-stats-row">
          <div className="skeleton" style={{ height: 90, borderRadius: 18 }} />
          <div className="skeleton" style={{ height: 90, borderRadius: 18 }} />
        </div>
        <div className="skeleton" style={{ height: 90, borderRadius: 18 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
        <div className="skeleton" style={{ height: 72, borderRadius: 14 }} />
        <div className="skeleton" style={{ height: 72, borderRadius: 14 }} />
        <div className="skeleton" style={{ height: 72, borderRadius: 14 }} />
      </div>
    </div>
  );
}
