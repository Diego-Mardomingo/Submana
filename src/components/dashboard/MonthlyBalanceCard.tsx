"use client";

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Bones } from "@/components/Bones";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { useJointAccountIds } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { useTransactionsRange } from "@/hooks/useTransactions";
import { appNow, monthKey } from "@/lib/date";
import { formatSignedWhole, monthName } from "@/lib/format";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { metricTransactions, sumByType } from "@/lib/metricsFilters";
import { balanceSummary, calendarGrid, historyMonths, monthlyBalances, tintStrength } from "@/lib/monthlyBalance";
import { cn } from "@/lib/utils";
import { CardHead, signClass, signedMoney } from "./shared";

type Month = { year: number; month: number };

/**
 * The result (income − expenses) of every month of the history, one tile each, in green or red with more
 * strength the bigger it is. The grid follows the calendar, scrolls when it grows past a year or two and opens
 * on the latest months. Tapping a month shows it in the month section below; that month's tile is marked.
 */
export default function MonthlyBalanceCard({ selected, onSelect }: { selected: Month; onSelect: (month: Month) => void }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const { byMonth, allKeys, isLoading } = useTransactionsRange();
  const { data: categories } = useCategories();
  const jointAccountIds = useJointAccountIds();
  const now = appNow();
  const currentKey = monthKey(now.getFullYear(), now.getMonth() + 1);
  const selectedKey = monthKey(selected.year, selected.month);

  const months = useMemo(() => {
    const [year, month] = currentKey.split("-").map(Number);
    return monthlyBalances(historyMonths(allKeys, { year, month }), (key) => {
      const rows = metricTransactions(byMonth.get(key) ?? [], categories, { jointAccountIds });
      return { ...sumByType(rows), count: rows.length };
    });
  }, [allKeys, byMonth, categories, jointAccountIds, currentKey]);
  const byKey = useMemo(() => new Map(months.map((m) => [m.key, m])), [months]);
  const cells = useMemo(() => calendarGrid(months.map((m) => m.key)), [months]);
  const summary = balanceSummary(months);

  // Opens on the latest months; afterwards keeps the selected month in view (the arrows below can move it).
  const gridRef = useRef<HTMLDivElement>(null);
  // Which edges of the grid have more months beyond them (they fade out).
  const [edges, setEdges] = useState({ above: false, below: false });
  const updateEdges = (grid: HTMLElement) => {
    const above = grid.scrollTop > 0;
    const below = grid.scrollTop + grid.clientHeight < grid.scrollHeight - 1;
    setEdges((prev) => (prev.above === above && prev.below === below ? prev : { above, below }));
  };
  const opened = useRef(false);
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    if (!opened.current) {
      opened.current = true;
      grid.scrollTop = grid.scrollHeight;
    } else {
      const tile = grid.querySelector<HTMLElement>(`[data-month="${selectedKey}"]`);
      if (tile) {
        const top = tile.offsetTop - grid.offsetTop;
        if (top < grid.scrollTop) grid.scrollTop = top;
        else if (top + tile.offsetHeight > grid.scrollTop + grid.clientHeight) grid.scrollTop = top + tile.offsetHeight - grid.clientHeight;
      }
    }
    updateEdges(grid);
  }, [selectedKey, cells.length]);

  if (isLoading) {
    return <Bones name="dashboard-months" loading fallback={<div className="lp-card skeleton dash-ym-skeleton" aria-hidden />} />;
  }
  if (summary.months === 0) return null;

  const first = months[0].key;
  const label = (key: string, style: "short" | "long" = "short") => `${monthName(Number(key.slice(5)), lang, style)} ${key.slice(0, 4)}`;
  const range = `${label(first).toLowerCase()} – ${label(currentKey).toLowerCase()}`;
  const caption = interpolate(t(summary.total >= 0 ? "dashboard.monthsSaved" : "dashboard.monthsLost"), {
    n: summary.months,
    months: t(summary.months === 1 ? "dashboard.monthOne" : "dashboard.monthMany"),
  });
  // "average {amount} a month": the amount goes through SensitiveAmount, so the text is split around it.
  const [averageBefore, averageAfter = ""] = t("dashboard.monthsAverage").split("{amount}");

  return (
    <Bones name="dashboard-months" loading={false}>
      <section className="lp-card dash-card dash-ym" aria-label={t("dashboard.monthlyBalance")}>
        <CardHead title={t("dashboard.monthlyBalance")}>
          <span className="dash-ym-range">{range}</span>
        </CardHead>
        <div>
          <span className={cn("lp-hero-value", signClass(summary.total))}>{signedMoney(summary.total)}</span>
          <span className="dash-hero-caption">
            {caption} · {averageBefore}
            <SensitiveAmount>{formatSignedWhole(summary.average)}</SensitiveAmount>
            {averageAfter}
          </span>
        </div>
        <div
          ref={gridRef}
          className={cn("dash-ym-grid", edges.above && "is-scrolled", edges.below && "has-more")}
          role="group"
          aria-label={t("dashboard.months")}
          onScroll={(e) => updateEdges(e.currentTarget)}
        >
          {cells.map((cell) => {
            const name = monthName(cell.month, lang);
            const year = cell.month === 1 || cell.key === first ? <small>{cell.year}</small> : null;
            if (cell.place !== "history") {
              return (
                <span key={cell.key} className={cn("dash-ym-tile", cell.place === "future" ? "is-future" : "is-void")} aria-hidden>
                  <span className="dash-ym-month">
                    {name}
                    {year}
                  </span>
                </span>
              );
            }
            const m = byKey.get(cell.key)!;
            const isCurrent = cell.key === currentKey;
            const amount = m.hasData ? formatSignedWhole(m.net) : "—";
            const aria = [
              label(cell.key, "long").toLowerCase(),
              m.hasData ? amount : t("dashboard.noTransactions"),
              isCurrent ? t("dashboard.inProgress") : null,
            ]
              .filter(Boolean)
              .join(", ");
            return (
              <button
                key={cell.key}
                type="button"
                data-month={cell.key}
                className={cn("dash-ym-tile", !m.hasData ? "is-empty" : m.net > 0 ? "is-up" : m.net < 0 && "is-down")}
                style={{ "--k": tintStrength(m.net, months).toFixed(2) } as CSSProperties}
                aria-pressed={cell.key === selectedKey}
                aria-label={aria}
                disabled={!m.hasData}
                onClick={() => onSelect({ year: cell.year, month: cell.month })}
              >
                <span className="dash-ym-month">
                  {name}
                  {year}
                  {isCurrent && <i className="dash-ym-now" aria-hidden />}
                </span>
                <span className="dash-ym-net">{m.hasData ? <SensitiveAmount>{amount}</SensitiveAmount> : amount}</span>
              </button>
            );
          })}
        </div>
        <div className="dash-legend" aria-hidden>
          <span>
            <i style={{ background: "var(--success)" }} />
            {interpolate(t("dashboard.monthsPositive"), { n: summary.positive })}
          </span>
          <span>
            <i style={{ background: "var(--danger)" }} />
            {interpolate(t("dashboard.monthsNegative"), { n: summary.negative })}
          </span>
          {summary.empty > 0 && (
            <span>
              <i className="dash-ym-swatch-empty" />
              {interpolate(t("dashboard.monthsEmpty"), { n: summary.empty })}
            </span>
          )}
          <span>
            <i className="dash-ym-now" />
            {t("dashboard.inProgress")}
          </span>
        </div>
      </section>
    </Bones>
  );
}
