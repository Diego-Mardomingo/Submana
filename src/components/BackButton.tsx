"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/hooks/useLang";
import type { UIKey } from "@/lib/i18n/ui";
import { useTranslations } from "@/lib/i18n/utils";
import { getParentRoute } from "@/lib/navigation";

const SECTION_LABELS: Record<string, UIKey> = {
  "/": "nav.home",
  "/transactions": "nav.transactions",
  "/accounts": "nav.accounts",
  "/subscriptions": "nav.subscriptions",
};

/** Link to the parent route, labelled with `label` or the parent section's name. */
export function BackButton({ label }: { label?: string }) {
  const t = useTranslations(useLang());
  const href = getParentRoute(usePathname());
  return (
    <Link
      href={href}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20, color: "var(--gris-claro)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 500 }}
      data-back-button
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label ?? t(SECTION_LABELS[href] ?? "common.back")}
    </Link>
  );
}
