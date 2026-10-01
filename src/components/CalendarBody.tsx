"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, House, List } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import { useCalendarAccountFilter } from "@/contexts/CalendarFilterContext";
import { useLang } from "@/hooks/useLang";
import { useMounted } from "@/hooks/useMediaQuery";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { useSwipe } from "@/hooks/useSwipe";
import { prefetchMonth, useTransactions } from "@/hooks/useTransactions";
import { appNow, shiftMonth, toAppDate } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { initialsAvatarDataUri } from "@/lib/initialsAvatar";
import { isPaymentDay } from "@/lib/subscriptions";
import { cn } from "@/lib/utils";
import { withViewTransition } from "@/lib/viewTransition";
import { AnimatedNumber } from "./AnimatedNumber";
import CalendarAccountFilter from "./CalendarAccountFilter";
import CalendarDayList, { type DayEntry } from "./CalendarDayList";
import Day from "./Day";

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
] as const;

export default function CalendarBody() {
  const lang = useLang();
  const t = useTranslations(lang);
  const queryClient = useQueryClient();
  const mounted = useMounted();
  const [{ year, month }, setView] = useState(() => ({ year: appNow().getFullYear(), month: appNow().getMonth() }));
  const [listOpen, setListOpen] = useState(false);
  const [scrollTarget, setScrollTarget] = useState<number | null>(null);
  const [swipeZone, setSwipeZone] = useState<HTMLDivElement | null>(null);
  const { data: subscriptions = [] } = useSubscriptions();
  const { data: transactions = [], isLoading } = useTransactions(year, month + 1);
  const { isAccountHidden } = useCalendarAccountFilter();

  const goTo = (target: { year: number; month: number }) => {
    if (target.year === year && target.month === month) return;
    const forward = target.year * 12 + target.month > year * 12 + month;
    withViewTransition(() => setView(target), "data-calendar-direction", forward ? "forward" : "back");
  };
  const changeMonth = (delta: number) => {
    const next = shiftMonth(year, month + 1, delta);
    goTo({ year: next.year, month: next.month - 1 });
  };
  const goToToday = () => goTo({ year: appNow().getFullYear(), month: appNow().getMonth() });
  const prefetch = (delta: number) => {
    const next = shiftMonth(year, month + 1, delta);
    prefetchMonth(queryClient, next.year, next.month);
  };

  useSwipe(swipeZone, { onSwipeLeft: () => changeMonth(1), onSwipeRight: () => changeMonth(-1), onDoubleTap: goToToday, onSwipeUp: goToToday });

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowLeft") changeMonth(-1);
    else if (e.key === "ArrowRight") changeMonth(1);
    else if (e.key === "ArrowDown") goToToday();
  });
  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Clicking a day opens the records list (if needed) and scrolls to that day once it has expanded.
  useEffect(() => {
    if (!listOpen || scrollTarget === null) return;
    const timer = setTimeout(() => {
      document.getElementById(`calendar-day-${scrollTarget}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollTarget(null);
    }, 300);
    return () => clearTimeout(timer);
  }, [listOpen, scrollTarget]);
  const scrollToDay = (day: number) => {
    setScrollTarget(day);
    setListOpen(true);
  };

  const today = appNow();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const visibleSubs = subscriptions.filter((sub) => !isAccountHidden(sub.account_id));
  const days: DayEntry[] = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNumber = i + 1;
    return {
      dayNumber,
      isToday: mounted && year === today.getFullYear() && month === today.getMonth() && dayNumber === today.getDate(),
      subs: visibleSubs.filter((sub) => isPaymentDay(sub, year, month, dayNumber)),
      transactions: transactions.filter((tx) => {
        const d = toAppDate(tx.date);
        return !isAccountHidden(tx.account_id) && d.getFullYear() === year && d.getMonth() === month && d.getDate() === dayNumber;
      }),
    };
  });
  const spent = days.reduce((sum, day) => sum + day.subs.reduce((s, sub) => s + Number(sub.cost), 0), 0);
  const firstWeekday = new Date(year, month, 1).getDay() || 7;
  const navButton = "rounded-full text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <div className="calendar_container">
      <header className="calendar_header">
        <div className="buttonsMonth">
          <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)} onMouseEnter={() => prefetch(-1)} aria-label="Previous" className={navButton}>
            <ChevronLeft className="size-5" strokeWidth={1.5} />
          </Button>
          <Button variant="ghost" size="icon" onClick={goToToday} aria-label={t("calendar.today")} className={navButton}>
            <House className="size-4" strokeWidth={1.5} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => changeMonth(1)} onMouseEnter={() => prefetch(1)} aria-label="Next" className={navButton}>
            <ChevronRight className="size-5" strokeWidth={1.5} />
          </Button>
        </div>
        <div className="header_left_group">
          <div className="header_text" onClick={goToToday} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && goToToday()}>
            <p className="nombre_mes">{t(`calendar.months.${MONTHS[month]}`)}</p>
            <p className="año">{year}</p>
          </div>
          <CalendarAccountFilter />
        </div>
        <div className="spent_container">
          <p className="spent_title">{t("calendar.monthly_spend")}</p>
          <div className={cn("spent_value", isLoading && "spent_value_loading")}>
            {isLoading ? (
              <Spinner className="size-5 text-primary" />
            ) : (
              <SensitiveAmount applyGradient>
                <AnimatedNumber value={Math.round(spent * 100) / 100} formatFn={formatCurrency} duration={350} />
              </SensitiveAmount>
            )}
          </div>
        </div>
      </header>
      <div ref={setSwipeZone} className="calendar_swipe_zone">
        <aside className="calendar_weekdays">
          {WEEKDAYS.map((day) => (
            <div key={day} className="diaSemana">
              {t(`calendar.${day}`)}
            </div>
          ))}
        </aside>
        <section className="calendar_body">
          {days.map((day, index) => (
            <Day
              key={day.dayNumber}
              dayNumber={day.dayNumber}
              dayStyle={index === 0 ? { gridColumnStart: firstWeekday } : undefined}
              isToday={day.isToday}
              subIcons={day.subs.map((sub) => sub.icon || initialsAvatarDataUri(sub.service_name))}
              transactions={day.transactions}
              onDayClick={scrollToDay}
            />
          ))}
        </section>
      </div>
      <Collapsible open={listOpen} onOpenChange={setListOpen}>
        <div className="calendar-records-panel">
          <CollapsibleTrigger asChild>
            <button type="button" className="calendar-records-trigger">
              <span className="flex items-center gap-2">
                <List className="size-4" strokeWidth={1.5} />
                {t("calendar.records_toggle")}
              </span>
              <ChevronDown
                className={cn("size-4 shrink-0 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]", listOpen && "rotate-180")}
                strokeWidth={1.5}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent forceMount className="calendar-collapsible-content">
            <div className="calendar-collapsible-inner">
              <CalendarDayList
                dayEntries={days.filter((day) => day.subs.length > 0 || day.transactions.length > 0)}
                year={year}
                month={month}
              />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
