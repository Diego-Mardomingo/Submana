"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { FieldGroup, FieldStack } from "@/components/SheetFields";
import { Sheet, SheetBody } from "@/components/ui/sheet";
import type { Transaction } from "@/hooks/useTransactions";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { api } from "@/lib/api";
import { appNow, monthKey } from "@/lib/date";
import { monthName } from "@/lib/format";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { monthCounts, pickerYears } from "@/lib/monthPicker";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

type Month = { year: number; month: number };

/** Every transaction: the same query and cache as `useTransactions()` without a month (the account page and the Dashboard load it). */
function useHistory(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.transactions.list({ year: undefined, month: undefined, accountId: undefined }),
    queryFn: () => api<Transaction[]>("/api/crud/transactions?"),
    enabled,
    staleTime: 60 * 1000,
  });
}

/** Scrolls the picker's own scroll box so the selected month's year is in view. */
function revealSelected(list: HTMLElement | null) {
  const year = list?.querySelector(".sf-month.is-selected")?.closest<HTMLElement>(".sf-months-year");
  let box = list?.parentElement ?? null;
  while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
  if (!year || !box) return;
  box.scrollTop += year.getBoundingClientRect().top - box.getBoundingClientRect().top - 12;
}

/** Months laid out by year; the number under each one is how many transactions it has. */
function MonthGrid({ value, counts, loading, onPick }: {
  value: Month;
  counts: Map<string, number>;
  loading: boolean;
  onPick: (month: Month) => void;
}) {
  const lang = useLang();
  const t = useTranslations(lang);
  const now = appNow();
  const today = monthKey(now.getFullYear(), now.getMonth() + 1);
  const selected = monthKey(value.year, value.month);
  const years = pickerYears(counts, value.year, now.getFullYear());
  const listRef = useRef<HTMLDivElement>(null);
  // On opening, and again when the counts arrive (the grid can gain years), bring the selected year into view.
  useLayoutEffect(() => revealSelected(listRef.current), [loading, years.length]);

  return (
    <div ref={listRef} className="sf-months-list">
      {years.map((year) => {
        let total = 0;
        const cells = Array.from({ length: 12 }, (_, i) => {
          const key = monthKey(year, i + 1);
          const count = counts.get(key) ?? 0;
          total += count;
          const name = monthName(i + 1, lang);
          return (
            <button
              key={key}
              type="button"
              className={cn("sf-month", !loading && count === 0 && "is-empty", key === today && "is-current", key === selected && "is-selected")}
              aria-pressed={key === selected}
              aria-label={loading ? `${monthName(i + 1, lang, "long")} ${year}` : interpolate(t("monthPicker.monthLabel"), { month: monthName(i + 1, lang, "long"), year, count })}
              onClick={() => onPick({ year, month: i + 1 })}
            >
              {name}
              <small>{loading ? "·" : count}</small>
            </button>
          );
        });
        return (
          <div key={year} className="sf-months-year">
            <span className="sf-months-year-label">
              {year}
              {!loading && <small>{interpolate(t("monthPicker.yearTotal"), { count: total })}</small>}
            </span>
            <div className="sf-months-grid">{cells}</div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The month's name as a button that opens a picker of every month by year (issue #122): a sheet on
 * phones, a dropdown under the name from tablet up. Picking a month calls `onChange` and closes it.
 * The history is only fetched once it opens; `include` narrows which transactions are counted (one
 * account, or Home without the accounts its filter hides). Keep `include` stable (useCallback).
 */
export function MonthPicker({ value, onChange, include, variant = "title" }: {
  value: Month;
  onChange: (month: Month) => void;
  include?: (tx: Transaction) => boolean;
  /** "title": the summary cards' month switcher. "home": Home's large calendar heading. */
  variant?: "title" | "home";
}) {
  const lang = useLang();
  const t = useTranslations(lang);
  const desktop = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useHistory(open);
  const counts = useMemo(() => monthCounts(data ?? [], include), [data, include]);

  const pick = (month: Month) => {
    setOpen(false);
    if (month.year !== value.year || month.month !== value.month) onChange(month);
  };

  const label = (
    <>
      {variant === "home" ? (
        // One text box, so a heading too long for its row is cut with an ellipsis instead of running under «Hoy».
        <span className="home-month-label">
          {monthName(value.month, lang, "long")} <span className="home-month-year">{value.year}</span>
        </span>
      ) : (
        <>
          <span>{monthName(value.month, lang, "long")}</span>
          <span className="lp-month-year">{value.year}</span>
        </>
      )}
      <ChevronDown className="lp-month-caret" strokeWidth={2.25} aria-hidden />
    </>
  );
  const triggerClass = variant === "home" ? "home-month-trigger" : "lp-month-trigger";
  const grid = <MonthGrid value={value} counts={counts} loading={isLoading} onPick={pick} />;

  if (desktop) {
    return (
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger asChild>
          <button type="button" className={triggerClass} title={t("monthPicker.title")}>
            {label}
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            className="month-pop"
            align={variant === "home" ? "start" : "center"}
            sideOffset={8}
            collisionPadding={12}
            aria-label={t("monthPicker.title")}
            // Focus the month being looked at, not the first month of the list.
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".sf-month.is-selected")?.focus({ preventScroll: true });
            }}
          >
            <p className="month-pop-hint">{t("monthPicker.hint")}</p>
            {grid}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    );
  }

  return (
    <>
      <button type="button" className={triggerClass} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        {label}
      </button>
      <Sheet open={open} onOpenChange={setOpen} title={t("monthPicker.title")} description={t("monthPicker.hint")}>
        <SheetBody>
          <FieldGroup>
            <FieldStack>{grid}</FieldStack>
          </FieldGroup>
        </SheetBody>
      </Sheet>
    </>
  );
}
