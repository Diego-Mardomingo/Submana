"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ChevronRight, MoreHorizontal, Tag } from "lucide-react";
import { Bones } from "@/components/Bones";
import { useJointAccountIds } from "@/hooks/useAccounts";
import { useCategories, useCategoryLookup } from "@/hooks/useCategories";
import { useMetricTransactions, useTransactionsRange, type DateRange, type Transaction } from "@/hooks/useTransactions";
import { categoryBreakdown, percentChange, type BreakdownCategory } from "@/lib/categoryBreakdown";
import { monthKey, shiftMonth } from "@/lib/date";
import { monthName } from "@/lib/format";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { metricTransactions } from "@/lib/metricsFilters";
import { cn } from "@/lib/utils";
import { CardHead, money } from "./shared";

type Month = { year: number; month: number };
/** Months shown, ending at the selected month. */
type Period = 1 | 3 | 12;

/** Categories with a colour of their own; the rest are grouped in "Others". */
const MAX_SHOWN = 6;
const PALETTE = ["var(--accent)", "var(--info)", "var(--teal)", "var(--warning)", "var(--success)", "var(--accent-light)"];
const OTHERS_COLOR = "var(--gris-claro)";
const OTHERS_KEY = "__others";
const NO_TRANSACTIONS: Transaction[] = [];

/** Metric transactions of the `period` months ending at `month`, and of the `period` months before. */
function usePeriodTransactions(month: Month, period: Period) {
  const previousMonth = shiftMonth(month.year, month.month, -1);
  const single = useMetricTransactions(month.year, month.month);
  const singlePrevious = useMetricTransactions(previousMonth.year, previousMonth.month);

  // Longer periods come from the full history (already loaded by the Trends cards).
  const range = useMemo<DateRange>(() => {
    const start = shiftMonth(month.year, month.month, -(2 * period - 1));
    return { startYear: start.year, startMonth: start.month, endYear: month.year, endMonth: month.month };
  }, [month.year, month.month, period]);
  const history = useTransactionsRange(undefined, range);
  const { data: categories } = useCategories();
  const jointAccountIds = useJointAccountIds();
  const fromHistory = useMemo(() => {
    if (period === 1) return { current: NO_TRANSACTIONS, previous: NO_TRANSACTIONS };
    const months = history.keys.map((key) => metricTransactions(history.byMonth.get(key) ?? [], categories, { jointAccountIds }));
    return { previous: months.slice(0, period).flat(), current: months.slice(period).flat() };
  }, [period, history.keys, history.byMonth, categories, jointAccountIds]);

  return period === 1
    ? { current: single.data, previous: singlePrevious.data, isLoading: single.isLoading }
    : { ...fromHistory, isLoading: history.isLoading };
}

/** "noviembre" / "sep – nov 2026" / "dic 2025 – nov 2026". */
function periodLabel(month: Month, period: Period, lang: "es" | "en") {
  if (period === 1) return monthName(month.month, lang, "long").toLowerCase();
  const start = shiftMonth(month.year, month.month, -(period - 1));
  const startLabel = monthName(start.month, lang).toLowerCase() + (start.year !== month.year ? ` ${start.year}` : "");
  return `${startLabel} – ${monthName(month.month, lang).toLowerCase()} ${month.year}`;
}

function Delta({ current, previous, es }: { current: number; previous: number; es: boolean }) {
  const change = percentChange(current, previous);
  if (change === null) return <span className="dash-cat-delta is-flat">{es ? "nuevo" : "new"}</span>;
  const rounded = Math.round(change);
  if (rounded === 0) return <span className="dash-cat-delta is-flat">=</span>;
  // More spending is the bad direction.
  return (
    <span
      className={cn("dash-cat-delta", rounded > 0 ? "is-up" : "is-down")}
      title={es ? "Frente al periodo anterior" : "Vs previous period"}
    >
      {rounded > 0 ? "▲" : "▼"} {Math.abs(rounded) >= 1000 ? "999+" : Math.abs(rounded)}%
    </span>
  );
}

type Keyed = BreakdownCategory & { key: string };
type Row = Keyed & { color: string; others?: Keyed[] };

/** Spending of the selected month(s) by category, each one expandable into its subcategories. */
export function CategoryBreakdownCard({ month, es }: { month: Month; es: boolean }) {
  const lang = es ? "es" : "en";
  const t = useTranslations(lang);
  const [period, setPeriod] = useState<Period>(1);
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [focused, setFocused] = useState<string | null>(null);
  const lookup = useCategoryLookup();
  const { current, previous, isLoading } = usePeriodTransactions(month, period);
  const breakdown = useMemo(() => categoryBreakdown(current, previous, lookup.parent), [current, previous, lookup.parent]);

  const rows = useMemo<Row[]>(() => {
    const keyed = breakdown.categories.map((c) => ({ ...c, key: c.id ?? "none" }));
    if (showAll || keyed.length <= MAX_SHOWN + 1) return keyed.map((c, i) => ({ ...c, color: PALETTE[i] ?? OTHERS_COLOR }));
    const rest = keyed.slice(MAX_SHOWN);
    const others: Row = {
      key: OTHERS_KEY,
      id: null,
      color: OTHERS_COLOR,
      total: rest.reduce((sum, c) => sum + c.total, 0),
      previous: rest.reduce((sum, c) => sum + c.previous, 0),
      subs: [],
      others: rest,
    };
    return [...keyed.slice(0, MAX_SHOWN).map((c, i) => ({ ...c, color: PALETTE[i] })), others];
  }, [breakdown.categories, showAll]);

  const categoryName = (c: { id: string | null; name?: string }) =>
    c.id ? (lookup.name.get(c.id) ?? c.name ?? t("dashboard.uncategorized")) : t("dashboard.uncategorized");
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const max = rows.reduce((m, r) => Math.max(m, r.total), 0);
  const share = (value: number, of: number) => (of > 0 ? `${Math.round((value / of) * 100)}%` : "0%");
  const periods: { value: Period; label: string }[] = [
    { value: 1, label: t("dashboard.periodMonth") },
    { value: 3, label: t("dashboard.period3Months") },
    { value: 12, label: t("dashboard.periodYear") },
  ];

  return (
    <div className="lp-card dash-card dash-card--list dash-cat-card">
      <CardHead title={t("dashboard.byCategory")}>
        <div className="dash-seg" role="radiogroup" aria-label={es ? "Periodo" : "Period"}>
          {periods.map((p) => (
            <button key={p.value} type="button" role="radio" aria-checked={period === p.value} onClick={() => setPeriod(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
      </CardHead>
      <Bones name="dashboard-categories" loading={isLoading} fallback={<div className="skeleton dash-block-skeleton" aria-hidden />}>
        {rows.length === 0 ? (
          <p className="dash-empty">{t("dashboard.noExpensesInPeriod")}</p>
        ) : (
          <div className="dash-cat-body lp-fade" key={`${monthKey(month.year, month.month)}-${period}`}>
            <div className="dash-cat-total">
              <span className="dash-cat-total-value">{money(breakdown.total)}</span>
              <span className="dash-hero-caption">{interpolate(t("dashboard.spentIn"), { period: periodLabel(month, period, lang) })}</span>
              <Delta current={breakdown.total} previous={breakdown.previous} es={es} />
            </div>
            <div className={cn("dash-cat-ribbon", focused && "has-focus")} aria-hidden>
              {rows.map((r) => (
                <span key={r.key} className={cn(focused === r.key && "is-on")} style={{ flexGrow: r.total, background: r.color }} />
              ))}
            </div>
            <ul className="dash-cat-list">
              {rows.map((r) => {
                const isOthers = r.key === OTHERS_KEY;
                const name = isOthers ? t("dashboard.otherCategories") : categoryName(r);
                const emoji = r.id ? lookup.emoji.get(r.id) : undefined;
                const expanded = open.has(r.key);
                const subs = isOthers
                  ? (r.others ?? []).map((c) => ({ key: c.key, label: `${(c.id && lookup.emoji.get(c.id)) || ""} ${categoryName(c)}`.trim(), none: false, total: c.total }))
                  : r.subs.map((s) => ({
                      key: s.id ?? "none",
                      label: s.id ? (lookup.name.get(s.id) ?? s.name ?? t("dashboard.noSubcategory")) : t("dashboard.noSubcategory"),
                      none: !s.id,
                      total: s.total,
                    }));
                const panelId = `dash-cat-${r.key}`;
                return (
                  <li
                    key={r.key}
                    className={cn("dash-cat", expanded && "is-open")}
                    style={{ "--c": r.color } as CSSProperties}
                    onMouseEnter={() => setFocused(r.key)}
                    onMouseLeave={() => setFocused(null)}
                  >
                    <button type="button" className="dash-cat-row" aria-expanded={expanded} aria-controls={panelId} onClick={() => toggle(r.key)}>
                      <span className="dash-cat-icon" aria-hidden>
                        {emoji ?? (isOthers ? <MoreHorizontal className="size-4" /> : <Tag className="size-4" />)}
                      </span>
                      <span className="dash-cat-main">
                        <span className="dash-cat-name">
                          <span>{name}</span>
                          <span className="dash-cat-share">{share(r.total, breakdown.total)}</span>
                        </span>
                        <span className="dash-cat-bar" aria-hidden>
                          <i style={{ width: `${max > 0 ? (r.total / max) * 100 : 0}%` }} />
                        </span>
                      </span>
                      <span className="dash-cat-amount">
                        <b>{money(r.total)}</b>
                        <Delta current={r.total} previous={r.previous} es={es} />
                      </span>
                      <ChevronRight className="dash-cat-chevron size-4" strokeWidth={2.25} aria-hidden />
                    </button>
                    <div className="dash-cat-subs" id={panelId} inert={!expanded}>
                      <ul>
                        {subs.map((s) => (
                          <li key={s.key} className="dash-cat-sub">
                            <span className={cn("dash-cat-sub-name", s.none && "is-none")}>{s.label}</span>
                            <span className="dash-cat-sub-amount">
                              {money(s.total)}
                              <span className="dash-cat-share"> · {share(s.total, r.total)}</span>
                            </span>
                            <span className="dash-cat-bar" aria-hidden>
                              <i style={{ width: `${r.total > 0 ? (s.total / r.total) * 100 : 0}%` }} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                );
              })}
            </ul>
            {breakdown.categories.length > MAX_SHOWN + 1 && (
              <button type="button" className="dash-cat-more" onClick={() => setShowAll((v) => !v)}>
                {showAll ? t("dashboard.groupSmallCategories") : interpolate(t("dashboard.showAllCategories"), { n: breakdown.categories.length })}
              </button>
            )}
          </div>
        )}
      </Bones>
    </div>
  );
}
