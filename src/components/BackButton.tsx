"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getParentRoute } from "@/lib/navigation";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import type { UIKey } from "@/lib/i18n/ui";

const parentPathToLabelKey: Record<string, UIKey> = {
  "/": "nav.home",
  "/dashboard": "nav.dashboard",
  "/transactions": "nav.transactions",
  "/accounts": "nav.accounts",
  "/subscriptions": "nav.subscriptions",
  "/categories": "nav.categories",
  "/budgets": "nav.budgets",
  "/notifications": "nav.notifications",
  "/settings": "nav.settings",
};

export interface BackButtonProps {
  /** Optional label (e.g. service name when editing a subscription). If not set, a default is derived from the parent route. */
  label?: string;
  /** Optional className for the link. */
  className?: string;
  /** Optional inline styles. */
  style?: React.CSSProperties;
}

const defaultLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 20,
  color: "var(--gris-claro)",
  textDecoration: "none",
  fontSize: "0.9rem",
  fontWeight: 500,
};

export function BackButton({ label, className, style }: BackButtonProps) {
  const pathname = usePathname();
  const lang = useLang();
  const t = useTranslations(lang);
  const href = getParentRoute(pathname ?? "/");

  if (href === pathname) {
    return null;
  }

  const labelKey = label ? undefined : (parentPathToLabelKey[href] ?? "common.back");
  const displayLabel = label ?? (labelKey ? t(labelKey) : "Back");

  return (
    <Link
      href={href}
      className={className}
      style={{ ...defaultLinkStyle, ...style }}
      data-back-button
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {displayLabel}
    </Link>
  );
}
