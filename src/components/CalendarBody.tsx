"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, House, ChevronDown, List } from "lucide-react";
import { useCalendarSwipe } from "@/hooks/useCalendarSwipe";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { useTransactions } from "@/hooks/useTransactions";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import Day from "./Day";
import CalendarDayList, { type DayEntry } from "./CalendarDayList";
import { AnimatedNumber } from "./AnimatedNumber";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { useCalendarAccountFilter } from "@/contexts/CalendarFilterContext";
import CalendarAccountFilter from "./CalendarAccountFilter";
import { cn } from "@/lib/utils";

const formatCurrency = (n: number) => {
  const formatted = new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(n);
  return `${formatted} €`;
};

function setToNoon(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
}

type TxForCalendar = { date: string };

type SubForCalendar = {
  start_date: string;
  end_date?: string | null;
  frequency: string;
  frequency_value?: number;
  icon?: string | null;
  cost?: number | string;
  account_id?: string | null;
};

function isPaymentDay(
  sub: SubForCalendar,
  year: number,
  month: number,
  dayNumber: number
) {
  const current = setToNoon(new Date(year, month, dayNumber));
  const start = setToNoon(new Date(sub.start_date));
  const startYear = start.getFullYear();
  const startMonth = start.getMonth();
  const startDay = start.getDate();
  if (start > current) return false;
  if (sub.end_date) {
    const end = setToNoon(new Date(sub.end_date));
    if (end < current) return false;
  }
  switch (sub.frequency) {
    case "weekly": {
      const msInDay = 86400000;
      const diffDays = Math.round((current.getTime() - start.getTime()) / msInDay);
      const interval = 7 * (sub.frequency_value || 1);
      return diffDays % interval === 0;
    }
    case "monthly": {
      const diffMonths = (year - startYear) * 12 + (month - startMonth);
      if (diffMonths < 0) return false;
      if (diffMonths % (sub.frequency_value || 1) === 0) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        return dayNumber === Math.min(startDay, daysInMonth);
      }
      return false;
    }
    case "yearly": {
      const diffYears = year - startYear;
      if (diffYears < 0) return false;
      if (diffYears % (sub.frequency_value || 1) === 0 && month === startMonth) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        return dayNumber === Math.min(startDay, daysInMonth);
      }
      return false;
    }
    default:
      return false;
  }
}

export default function CalendarBody() {
  const lang = useLang();
  const t = useTranslations(lang);
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [listOpen, setListOpen] = useState(false);
  const scrollTargetRef = useRef<number | null>(null);

  const scrollToDay = (dayNumber: number) => {
    const doScroll = () => {
      const el = document.getElementById(`calendar-day-${dayNumber}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    if (listOpen) {
      doScroll();
    } else {
      scrollTargetRef.current = dayNumber;
      setListOpen(true);
    }
  };

  useEffect(() => {
    if (!listOpen || scrollTargetRef.current === null) return;
    const dayNum = scrollTargetRef.current;
    const timer = setTimeout(() => {
      const el = document.getElementById(`calendar-day-${dayNum}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      scrollTargetRef.current = null;
    }, 300);
    return () => clearTimeout(timer);
  }, [listOpen]);

  const { data: subscriptions = [] } = useSubscriptions();
  const { data: transactions = [], isLoading } = useTransactions(year, month + 1);
  const { isAccountHidden } = useCalendarAccountFilter();

  const diasSemana = [
    t("calendar.monday"),
    t("calendar.tuesday"),
    t("calendar.wednesday"),
    t("calendar.thursday"),
    t("calendar.friday"),
    t("calendar.saturday"),
    t("calendar.sunday"),
  ];
  const meses = [
    t("calendar.months.january"),
    t("calendar.months.february"),
    t("calendar.months.march"),
    t("calendar.months.april"),
    t("calendar.months.may"),
    t("calendar.months.june"),
    t("calendar.months.july"),
    t("calendar.months.august"),
    t("calendar.months.september"),
    t("calendar.months.october"),
    t("calendar.months.november"),
    t("calendar.months.december"),
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startColumn = firstDayOfMonth === 0 ? 7 : firstDayOfMonth;

  const changeMonth = (delta: number) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }

    const direction = delta > 0 ? "forward" : "back";
    
    if (
      typeof document !== "undefined" &&
      "startViewTransition" in document &&
      typeof document.startViewTransition === "function"
    ) {
      document.documentElement.setAttribute("data-calendar-direction", direction);
      const transition = document.startViewTransition(() => {
        setMonth(newMonth);
        setYear(newYear);
      });
      transition.finished.finally(() => {
        document.documentElement.removeAttribute("data-calendar-direction");
      });
    } else {
      setMonth(newMonth);
      setYear(newYear);
    }
  };

  const handleToday = () => {
    const todayYear = new Date().getFullYear();
    const todayMonth = new Date().getMonth();
    
    if (year === todayYear && month === todayMonth) return;
    
    const isFuture = year > todayYear || (year === todayYear && month > todayMonth);
    const direction = isFuture ? "back" : "forward";
    
    if (
      typeof document !== "undefined" &&
      "startViewTransition" in document &&
      typeof document.startViewTransition === "function"
    ) {
      document.documentElement.setAttribute("data-calendar-direction", direction);
      const transition = document.startViewTransition(() => {
        setYear(todayYear);
        setMonth(todayMonth);
      });
      transition.finished.finally(() => {
        document.documentElement.removeAttribute("data-calendar-direction");
      });
    } else {
      setYear(todayYear);
      setMonth(todayMonth);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "ArrowLeft") {
        changeMonth(-1);
      } else if (e.key === "ArrowRight") {
        changeMonth(1);
      } else if (e.key === "ArrowDown") {
        handleToday();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [month, year]);

  const prefetchMonth = (delta: number) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    queryClient.prefetchQuery({
      queryKey: queryKeys.transactions.list({ year: newYear, month: newMonth + 1 }),
    });
  };

  const getSubsIconsForDay = (dayNumber: number) =>
    subscriptions
      .filter((sub: SubForCalendar) => !isAccountHidden(sub.account_id))
      .flatMap((sub: SubForCalendar) =>
        isPaymentDay(sub, year, month, dayNumber) ? [sub.icon] : []
      );
  const getSubsForDay = (dayNumber: number) =>
    subscriptions
      .filter((sub: SubForCalendar) => !isAccountHidden(sub.account_id))
      .filter((sub: SubForCalendar) => isPaymentDay(sub, year, month, dayNumber));
  type TxWithAmount = TxForCalendar & {
    id: string;
    amount?: number;
    type?: string;
    description?: string | null;
    category?: { name: string } | null;
    subcategory?: { name: string } | null;
    account_id?: string | null;
  };
  const getTransactionsForDay = (dayNumber: number): TxWithAmount[] =>
    (transactions || [])
      .filter((tx: TxWithAmount) => !isAccountHidden(tx.account_id))
      .filter((tx: TxWithAmount) => {
        const d = new Date(tx.date);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === dayNumber;
      });

  const getSpentValue = () => {
    let spent = 0;
    daysArray.forEach((dayNumber) => {
      subscriptions
        .filter((sub: SubForCalendar) => !isAccountHidden(sub.account_id))
        .forEach((sub: SubForCalendar) => {
          if (isPaymentDay(sub, year, month, dayNumber)) {
            spent = parseFloat((spent + Number(sub.cost)).toFixed(2));
          }
        });
    });
    return spent;
  };

  const getIsToday = (dayNumber: number) =>
    year === new Date().getFullYear() &&
    month === new Date().getMonth() &&
    dayNumber === new Date().getDate();
  const swipeZoneRef = useRef<HTMLDivElement>(null);
  useCalendarSwipe(swipeZoneRef, {
    onSwipeLeft: () => changeMonth(1),
    onSwipeRight: () => changeMonth(-1),
    onDoubleTap: handleToday,
    onSwipeUp: handleToday,
  });

  const dayEntries: DayEntry[] = (() => {
    const daysWithContent = new Set<number>();
    daysArray.forEach((d) => {
      const subs = getSubsForDay(d);
      const txs = getTransactionsForDay(d);
      if (subs.length > 0 || txs.length > 0) daysWithContent.add(d);
    });
    return Array.from(daysWithContent)
      .sort((a, b) => a - b)
      .map((dayNumber) => ({
        dayNumber,
        isToday: getIsToday(dayNumber),
        subs: getSubsForDay(dayNumber) as DayEntry["subs"],
        transactions: getTransactionsForDay(dayNumber) as unknown as DayEntry["transactions"],
      }));
  })();

  return (
    <div className="calendar_container">
      <header className="calendar_header">
        <div className="buttonsMonth">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => changeMonth(-1)}
            onMouseEnter={() => prefetchMonth(-1)}
            aria-label="Previous"
            className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-5" strokeWidth={1.5} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToday}
            aria-label={t("calendar.today")}
            className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <House className="size-4" strokeWidth={1.5} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => changeMonth(1)}
            onMouseEnter={() => prefetchMonth(1)}
            aria-label="Next"
            className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-5" strokeWidth={1.5} />
          </Button>
        </div>
        <div className="header_left_group">
          <div className="header_text" onClick={handleToday} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && handleToday()}>
            <p className="nombre_mes">{meses[month]}</p>
            <p className="año">{year}</p>
          </div>
          <CalendarAccountFilter />
        </div>
        <div className="spent_container">
          <p className="spent_title">{t("calendar.monthly_spend")}</p>
          <div className={`spent_value ${isLoading ? "spent_value_loading" : ""}`}>
            {isLoading ? (
              <Spinner className="size-5 text-primary" />
            ) : (
              <AnimatedNumber
                value={getSpentValue()}
                formatFn={formatCurrency}
                duration={350}
              />
            )}
          </div>
        </div>
      </header>
      <div
        ref={swipeZoneRef}
        className="calendar_swipe_zone"
      >
      <aside className="calendar_weekdays">
        {diasSemana.map((dia) => (
          <div key={dia} className="diaSemana">
            {dia}
          </div>
        ))}
      </aside>
      <section
        className="calendar_body"
        style={{ viewTransitionName: "calendar-grid" }}
      >
        {daysArray.map((dayNumber, index) => {
          const styleObj = index === 0 ? { gridColumnStart: startColumn } : {};
          return (
            <Day
              key={dayNumber}
              dayNumber={dayNumber}
              dayStyle={styleObj}
              isToday={getIsToday(dayNumber)}
              icons={getSubsIconsForDay(dayNumber)}
              subsForDay={getSubsForDay(dayNumber)}
              transactions={getTransactionsForDay(dayNumber) as { id: string; amount: number; type: string; description?: string; category?: { name: string }; subcategory?: { name: string } }[]}
              onDayClick={scrollToDay}
            />
          );
        })}
      </section>
      </div>
      <Collapsible open={listOpen} onOpenChange={setListOpen}>
        <div className="calendar-records-panel">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="calendar-records-trigger"
            >
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
              <CalendarDayList dayEntries={dayEntries} year={year} month={month} />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
