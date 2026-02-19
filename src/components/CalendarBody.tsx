"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { useTransactions } from "@/hooks/useTransactions";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import Day from "./Day";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";

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
  const [activeDay, setActiveDay] = useState<number | null>(null);

  const { data: subscriptions = [] } = useSubscriptions();
  const { data: transactions = [], isLoading } = useTransactions(year, month);

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
    const go = () => {
      let newMonth = month + delta;
      let newYear = year;
      if (newMonth < 0) {
        newMonth = 11;
        newYear--;
      } else if (newMonth > 11) {
        newMonth = 0;
        newYear++;
      }
      setMonth(newMonth);
      setYear(newYear);
    };
    if (typeof document !== "undefined" && (document as Document & { startViewTransition?: (cb: () => void) => void }).startViewTransition) {
      (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(() => flushSync(go));
    } else {
      go();
    }
  };

  const handleToday = () => {
    const go = () => {
      setYear(new Date().getFullYear());
      setMonth(new Date().getMonth());
    };
    if (typeof document !== "undefined" && (document as Document & { startViewTransition?: (cb: () => void) => void }).startViewTransition) {
      (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(() => flushSync(go));
    } else {
      go();
    }
  };

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
      queryKey: queryKeys.transactions.list({ year: newYear, month: newMonth }),
    });
  };

  const getSubsIconsForDay = (dayNumber: number) =>
    subscriptions.flatMap((sub: SubForCalendar) =>
      isPaymentDay(sub, year, month, dayNumber) ? [sub.icon] : []
    );
  const getSubsForDay = (dayNumber: number) =>
    subscriptions.filter((sub: SubForCalendar) => isPaymentDay(sub, year, month, dayNumber));
  const getTransactionsForDay = (dayNumber: number) =>
    (transactions || []).filter((tx: TxForCalendar) => {
      const d = new Date(tx.date);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === dayNumber;
    });
  const getIsToday = (dayNumber: number) =>
    year === new Date().getFullYear() &&
    month === new Date().getMonth() &&
    dayNumber === new Date().getDate();
  const getSpentValue = () => {
    let spent = 0;
    daysArray.forEach((dayNumber) => {
      subscriptions.forEach((sub: SubForCalendar) => {
        if (isPaymentDay(sub, year, month, dayNumber)) {
          spent = parseFloat((spent + Number(sub.cost)).toFixed(2));
        }
      });
    });
    return spent;
  };

  return (
    <div className="calendar_container">
      <header className="calendar_header">
        <div className="buttonsMonth">
          <button type="button" onClick={() => changeMonth(-1)} onMouseEnter={() => prefetchMonth(-1)} aria-label="Previous">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <button type="button" onClick={handleToday} className="today-btn-desktop" aria-label={t("calendar.today")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12l-2 0 9 -9 9 9 -2 0" />
              <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" />
            </svg>
          </button>
          <button type="button" onClick={() => changeMonth(1)} onMouseEnter={() => prefetchMonth(1)} aria-label="Next">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6l6 6 -6 6" />
            </svg>
          </button>
        </div>
        <div className="header_text" onClick={handleToday} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && handleToday()}>
          <p className="nombre_mes">{meses[month]}</p>
          <p className="año">{year}</p>
        </div>
        <div className="spent_container">
          <p className="spent_title">{t("calendar.monthly_spend")}</p>
          <div className="spent_value">
            {isLoading ? (
              <span style={{ opacity: 0.6 }}>...</span>
            ) : (
              <>
                {getSpentValue()} €
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 3.34a10 10 0 1 1 -15 8.66l.005 -.324a10 10 0 0 1 14.995 -8.336zm-5 2.66c-2.052 0 -3.768 1.449 -4.549 3.5h-.451a1 1 0 0 0 -.117 1.993l.134 .007a7.298 7.298 0 0 0 0 1h-.017a1 1 0 0 0 0 2h.452c.78 2.053 2.496 3.5 4.548 3.5" />
                </svg>
              </>
            )}
          </div>
        </div>
      </header>
      <aside style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.35rem" }}>
        {diasSemana.map((dia) => (
          <div key={dia} className="diaSemana">
            {dia}
          </div>
        ))}
      </aside>
      <section className="calendar_body">
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
              transactions={getTransactionsForDay(dayNumber)}
              activeDay={activeDay}
              setActiveDay={setActiveDay}
            />
          );
        })}
      </section>
    </div>
  );
}
