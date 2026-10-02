"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { signed } from "@/components/TransactionDayList";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

// Charts need the browser (canvas, CSS variables): load them client-side behind a placeholder.
const ChartSkeleton = () => <div className="skeleton dash-chart-skeleton" />;
export const BalanceLine = dynamic(() => import("./charts").then((m) => m.BalanceLine), { ssr: false, loading: ChartSkeleton });
export const IncomeExpenseBars = dynamic(() => import("./charts").then((m) => m.IncomeExpenseBars), { ssr: false, loading: ChartSkeleton });

export const money = (n: number) => <SensitiveAmount>{formatCurrency(n)}</SensitiveAmount>;
/** "+1.234,56 €" / "-12,00 €" (plain "0,00 €" for zero). */
export const signedMoney = (n: number) => <SensitiveAmount>{n === 0 ? formatCurrency(0) : signed(n)}</SensitiveAmount>;
export const signClass = (n: number) => (n > 0 ? "is-income" : n < 0 ? "is-negative" : "is-muted");

/** Card title row with an optional action (link, range picker…) on the right. */
export function CardHead({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="dash-card-head">
      <h2 className="lp-section-title">{title}</h2>
      {children}
    </div>
  );
}

/** Small "See all ›" link for card headers. */
export function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="dash-see-all">
      {label}
      <ChevronRight className="size-3.5" strokeWidth={2.5} aria-hidden />
    </Link>
  );
}

export function Stat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className="lp-stat">
      <span className="lp-label">{label}</span>
      <span className={cn("lp-stat-value", className)}>{value}</span>
    </div>
  );
}
