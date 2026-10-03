"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Plus, Repeat } from "lucide-react";
import CalendarAccountFilter from "@/components/CalendarAccountFilter";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { useFrequencyLabel } from "@/components/SubscriptionDialogs";
import { SubscriptionIcon } from "@/components/SubscriptionsBody";
import { SubscriptionSheet } from "@/components/SubscriptionSheet";
import { signed, TransactionRow, transactionEmoji } from "@/components/TransactionDayList";
import { TransactionSheet } from "@/components/TransactionSheet";
import { useCalendarAccountFilter } from "@/contexts/CalendarFilterContext";
import { useJointAccountIds } from "@/hooks/useAccounts";
import { useCategories, useCategoryLookup } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { useMounted } from "@/hooks/useMediaQuery";
import { useSubscriptions, type Subscription } from "@/hooks/useSubscriptions";
import { useSwipe } from "@/hooks/useSwipe";
import { useTransactions, type Transaction } from "@/hooks/useTransactions";
import { appNow, calendarDayInAppTimeZone, monthKey, shiftMonth } from "@/lib/date";
import { formatCurrency, localeOf, monthName } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { initialsAvatarDataUri } from "@/lib/initialsAvatar";
import { metricTransactions } from "@/lib/metricsFilters";
import { isPaymentDay } from "@/lib/subscriptions";
import { cn } from "@/lib/utils";

type Month = { year: number; month: number };
type DayData = { day: number; subs: Subscription[]; txs: Transaction[] };

const currentMonth = (): Month => ({ year: appNow().getFullYear(), month: appNow().getMonth() + 1 });
/** Sortable yyyymmdd number, to compare days without building dates. */
const stamp = (year: number, month: number, day: number) => year * 10000 + month * 100 + day;
/** Day net for the cell: "+48", "-1,2k" (no decimals or currency, it has to fit a narrow cell). */
function compactAmount(n: number) {
  const abs = Math.abs(n);
  const value = abs >= 1000 ? `${(abs / 1000).toFixed(abs >= 10_000 ? 0 : 1).replace(".", ",")}k` : String(Math.round(abs));
  return `${n > 0 ? "+" : "-"}${value}`;
}
/** 2024-01-01 was a Monday: the week starts on Monday. */
const WEEK = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i));

/** Subscription logos of a day: up to two, or the first one plus "+N". */
function DayLogos({ subs }: { subs: Subscription[] }) {
  if (subs.length === 0) return null;
  const shown = subs.length > 2 ? subs.slice(0, 1) : subs;
  return (
    <span className="cal-day-logos" aria-hidden>
      {shown.map((sub) => (
        // eslint-disable-next-line @next/next/no-img-element -- remote service logos
        <img key={sub.id} src={sub.icon || initialsAvatarDataUri(sub.service_name)} alt="" className="cal-day-logo" />
      ))}
      {subs.length > 2 && <span className="cal-day-more">+{subs.length - 1}</span>}
    </span>
  );
}

/**
 * Home: month calendar with each day's subscription charges and income / expense marks, and the
 * picked day's agenda below (beside it on desktop), where its movements can be opened or added.
 */
export default function CalendarBody() {
  const lang = useLang();
  const es = lang === "es";
  const t = useTranslations(lang);
  const freqLabel = useFrequencyLabel();
  const mounted = useMounted();
  const [view, setView] = useState(currentMonth);
  const [picked, setPicked] = useState<number | null>(null);
  const [swipeArea, setSwipeArea] = useState<HTMLElement | null>(null);
  const agendaRef = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [creating, setCreating] = useState(false);
  const [openSub, setOpenSub] = useState<Subscription | null>(null);

  const { data: subscriptions = [] } = useSubscriptions();
  const { data: transactions = [], isLoading, isFetching, isPlaceholderData } = useTransactions(view.year, view.month);
  const { data: categories } = useCategories();
  const jointAccountIds = useJointAccountIds();
  const categoryLookup = useCategoryLookup();
  const { isAccountHidden } = useCalendarAccountFilter();

  const goTo = (target: Month, day: number | null = null) => {
    setView(target);
    setPicked(day);
  };
  const changeMonth = (delta: number) => goTo(shiftMonth(view.year, view.month, delta));
  const goToToday = () => goTo(currentMonth());

  useSwipe(swipeArea, { onSwipeLeft: () => changeMonth(1), onSwipeRight: () => changeMonth(-1) }, 50);
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.closest("[role=dialog]")) return;
    if (e.key === "ArrowLeft") changeMonth(-1);
    else if (e.key === "ArrowRight") changeMonth(1);
    else if (e.key === "ArrowDown") goToToday();
  });
  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // "Today" depends on the client clock: unknown while rendering on the server.
  const now = mounted ? appNow() : null;
  const todayStamp = now ? stamp(now.getFullYear(), now.getMonth() + 1, now.getDate()) : null;
  const isCurrent = !!now && view.year === now.getFullYear() && view.month === now.getMonth() + 1;
  const monthLoading = isLoading || isPlaceholderData;

  const key = monthKey(view.year, view.month);
  const daysInMonth = new Date(view.year, view.month, 0).getDate();
  const days: DayData[] = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, subs: [], txs: [] }));
  if (!monthLoading) {
    for (const tx of transactions) {
      const date = calendarDayInAppTimeZone(tx.date);
      if (date.startsWith(key) && !isAccountHidden(tx.account_id)) days[Number(date.slice(8)) - 1].txs.push(tx);
    }
  }
  for (const sub of subscriptions) {
    if (isAccountHidden(sub.account_id)) continue;
    for (const entry of days) if (isPaymentDay(sub, view.year, view.month - 1, entry.day)) entry.subs.push(sub);
  }
  const countedIds = new Set(metricTransactions(transactions, categories, { jointAccountIds }).map((tx) => tx.id));
  const isCharged = (day: number) => todayStamp !== null && stamp(view.year, view.month, day) <= todayStamp;

  // Subscriptions of the month: what has already been charged and what is still to come.
  let charged = 0;
  let pending = 0;
  let pendingCount = 0;
  for (const entry of days) {
    for (const sub of entry.subs) {
      if (isCharged(entry.day)) charged += Number(sub.cost);
      else {
        pending += Number(sub.cost);
        pendingCount++;
      }
    }
  }
  const subsTotal = charged + pending;

  // Picked day, or today in the current month, or the month's first day with something on it.
  const firstActive = days.find((d) => d.subs.length > 0 || d.txs.length > 0)?.day;
  const selected = Math.min(picked ?? (isCurrent && now ? now.getDate() : (firstActive ?? 1)), daysInMonth);
  const selectedDay = days[selected - 1];
  const selectedDate = new Date(view.year, view.month - 1, selected, 12);

  const pick = (day: number) => {
    setPicked(day);
    // On phones the agenda sits below the grid: bring it into view when it is mostly hidden.
    requestAnimationFrame(() => {
      const agenda = agendaRef.current;
      if (agenda && agenda.getBoundingClientRect().top > window.innerHeight - 180) agenda.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const locale = localeOf(lang);
  const dayLabel = (() => {
    const date = selectedDate.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "short" });
    if (!now) return { title: date };
    const offset = Math.round((selectedDate.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime()) / 86_400_000);
    const relative = offset === 0 ? (es ? "Hoy" : "Today") : offset === -1 ? (es ? "Ayer" : "Yesterday") : offset === 1 ? (es ? "Mañana" : "Tomorrow") : null;
    return relative ? { title: relative, detail: date } : { title: date };
  })();
  const dayNet = selectedDay.txs.reduce((sum, tx) => (countedIds.has(tx.id) ? sum + (tx.type === "income" ? 1 : -1) * Number(tx.amount) : sum), 0);
  const subStatus = (day: number) => {
    const s = stamp(view.year, view.month, day);
    if (todayStamp === null) return null;
    if (s === todayStamp) return { label: es ? "Cobro hoy" : "Charged today", soon: true };
    return s < todayStamp ? { label: es ? "Cobrado" : "Charged", soon: false } : { label: es ? "Pendiente" : "Upcoming", soon: true };
  };

  const firstWeekday = new Date(view.year, view.month - 1, 1).getDay() || 7;
  const liveSub = openSub ? (subscriptions.find((s) => s.id === openSub.id) ?? openSub) : null;

  return (
    <div className="page-container lp-page cal-page fade-in">
      <header className="lp-header">
        <h1>{es ? "Calendario" : "Calendar"}</h1>
        <CalendarAccountFilter />
      </header>

      <div className="cal-layout">
        <section ref={setSwipeArea} className="lp-card cal-card" aria-label={es ? "Calendario del mes" : "Month calendar"}>
          <div className="lp-month cal-month">
            <button type="button" className="lp-icon-btn" onClick={() => changeMonth(-1)} aria-label={es ? "Mes anterior" : "Previous month"}>
              <ChevronLeft className="size-5" strokeWidth={2} />
            </button>
            <div className="lp-month-title">
              <span>{monthName(view.month, lang, "long")}</span>
              <span className="lp-month-year">{view.year}</span>
              {isFetching && monthLoading ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label={es ? "Cargando" : "Loading"} />
              ) : (
                mounted &&
                !isCurrent && (
                  <button type="button" className="lp-chip" onClick={goToToday}>
                    {es ? "Hoy" : "Today"}
                  </button>
                )
              )}
            </div>
            <button type="button" className="lp-icon-btn" onClick={() => changeMonth(1)} aria-label={es ? "Mes siguiente" : "Next month"}>
              <ChevronRight className="size-5" strokeWidth={2} />
            </button>
          </div>

          {subsTotal > 0 && (
            <div className="cal-subs lp-fade" key={`subs-${key}`}>
              <div className="cal-subs-head">
                <span className="lp-label">{es ? "Suscripciones del mes" : "Subscriptions this month"}</span>
                <span className="cal-subs-total">
                  <SensitiveAmount>{formatCurrency(subsTotal)}</SensitiveAmount>
                </span>
              </div>
              <div className="lp-meter cal-subs-meter" aria-hidden>
                <span style={{ width: `${(charged / subsTotal) * 100}%`, background: "var(--accent)" }} />
              </div>
              <div className="cal-subs-legend">
                <span>
                  <i className="cal-legend-dot" style={{ background: "var(--accent)" }} aria-hidden />
                  {es ? "Cobrado" : "Charged"} <SensitiveAmount>{formatCurrency(charged)}</SensitiveAmount>
                </span>
                <span>
                  <i className="cal-legend-dot" aria-hidden />
                  {es ? "Pendiente" : "Upcoming"} <SensitiveAmount>{formatCurrency(pending)}</SensitiveAmount>
                  {pendingCount > 0 && <span className="cal-subs-count"> · {pendingCount}</span>}
                </span>
              </div>
            </div>
          )}

          <div className="cal-weekdays" aria-hidden>
            {WEEK.map((date) => (
              <span key={date.getDay()}>
                <span className="cal-weekday-narrow">{date.toLocaleDateString(locale, { weekday: "narrow" })}</span>
                <span className="cal-weekday-short">{date.toLocaleDateString(locale, { weekday: "short" }).replace(".", "")}</span>
              </span>
            ))}
          </div>
          <div className="cal-grid lp-fade" key={`grid-${key}`} role="group" aria-label={`${monthName(view.month, lang, "long")} ${view.year}`}>
            {days.map((entry) => {
              const counted = entry.txs.filter((tx) => countedIds.has(tx.id));
              const income = counted.some((tx) => tx.type === "income");
              const net = counted.reduce((sum, tx) => sum + (tx.type === "income" ? 1 : -1) * Number(tx.amount), 0);
              const expense = counted.some((tx) => tx.type === "expense");
              const other = !income && !expense && entry.txs.length > 0;
              const isToday = todayStamp === stamp(view.year, view.month, entry.day);
              const isSelected = entry.day === selected;
              const date = new Date(view.year, view.month - 1, entry.day).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
              const activity = [
                entry.subs.length > 0 && `${entry.subs.length} ${es ? (entry.subs.length === 1 ? "cobro" : "cobros") : entry.subs.length === 1 ? "charge" : "charges"}`,
                entry.txs.length > 0 && `${entry.txs.length} ${es ? (entry.txs.length === 1 ? "movimiento" : "movimientos") : entry.txs.length === 1 ? "transaction" : "transactions"}`,
              ].filter(Boolean);
              return (
                <button
                  key={entry.day}
                  type="button"
                  className={cn("cal-day", isToday && "is-today", isSelected && "is-selected", todayStamp !== null && stamp(view.year, view.month, entry.day) < todayStamp && "is-past")}
                  style={entry.day === 1 ? { gridColumnStart: firstWeekday } : undefined}
                  aria-pressed={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={[date, ...activity].join(", ")}
                  onClick={() => pick(entry.day)}
                >
                  <span className="cal-day-num">{entry.day}</span>
                  <DayLogos subs={entry.subs} />
                  {(income || expense || other) && (
                    <span className="cal-day-foot" aria-hidden>
                      {/* With a net amount one mark of its sign is enough (two would crowd a narrow cell). */}
                      <span className="cal-day-dots">
                        {net !== 0 ? (
                          <i className={net > 0 ? "is-income" : "is-expense"} />
                        ) : (
                          <>
                            {income && <i className="is-income" />}
                            {expense && <i className="is-expense" />}
                            {other && <i />}
                          </>
                        )}
                      </span>
                      {net !== 0 && (
                        <span className={cn("cal-day-net", net > 0 && "is-income")}>
                          <SensitiveAmount>{compactAmount(net)}</SensitiveAmount>
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section ref={agendaRef} className="lp-section cal-agenda" aria-label={es ? "Agenda del día" : "Day agenda"}>
          <div className="lp-section-head">
            <span className="lp-section-title">
              {dayLabel.title}
              {dayLabel.detail && <small>{dayLabel.detail}</small>}
            </span>
            {!monthLoading && dayNet !== 0 && (
              <span className={cn("lp-section-aside", dayNet > 0 && "is-income")}>
                <SensitiveAmount>{signed(dayNet)}</SensitiveAmount>
              </span>
            )}
          </div>
          <div className="lp-card lp-group lp-fade" key={`${key}-${selected}`}>
            {selectedDay.subs.map((sub) => {
              const status = subStatus(selected);
              return (
                <button key={`sub-${sub.id}`} type="button" className="lp-row" onClick={() => setOpenSub(sub)}>
                  <SubscriptionIcon sub={sub} />
                  <span className="lp-main">
                    <span className="lp-title">
                      <span>{sub.service_name}</span>
                    </span>
                    <span className="lp-meta">
                      <Repeat className="cal-meta-icon" strokeWidth={2.5} aria-hidden />
                      <span className="lp-truncate">{freqLabel(sub)}</span>
                      {status && (
                        <>
                          <span className="lp-meta-sep">·</span>
                          <span className={status.soon ? "lp-soon" : undefined}>{status.label}</span>
                        </>
                      )}
                    </span>
                  </span>
                  <span className="lp-amount is-expense">
                    -<SensitiveAmount>{formatCurrency(Number(sub.cost))}</SensitiveAmount>
                  </span>
                </button>
              );
            })}

            {monthLoading ? (
              <div className="lp-skeleton-row" aria-hidden>
                <div className="skeleton" />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div className="skeleton" style={{ height: 12, width: "55%" }} />
                  <div className="skeleton" style={{ height: 10, width: "35%" }} />
                </div>
                <div className="skeleton" style={{ height: 12, width: 56 }} />
              </div>
            ) : (
              selectedDay.txs.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  emoji={transactionEmoji(categoryLookup, tx)}
                  fallbackLabel={t(tx.type === "income" ? "transactions.income" : "transactions.expense")}
                  onOpen={setEditing}
                  excluded={!countedIds.has(tx.id)}
                />
              ))
            )}

            {!monthLoading && selectedDay.subs.length === 0 && selectedDay.txs.length === 0 && (
              <p className="cal-agenda-empty">{es ? "Nada este día" : "Nothing on this day"}</p>
            )}

            <button type="button" className="lp-row cal-add-row" onClick={() => setCreating(true)}>
              <span className="lp-icon cal-add-icon" aria-hidden>
                <Plus className="size-[18px]" strokeWidth={2.5} />
              </span>
              <span className="lp-main">
                <span className="lp-title">
                  <span>{es ? "Añadir movimiento" : "Add transaction"}</span>
                </span>
              </span>
            </button>
          </div>
        </section>
      </div>

      <TransactionSheet open={creating} onOpenChange={setCreating} defaultDate={selectedDate} />
      <TransactionSheet open={!!editing} onOpenChange={(open) => !open && setEditing(null)} transaction={editing} />
      <SubscriptionSheet open={!!openSub} onOpenChange={(open) => !open && setOpenSub(null)} subscription={liveSub} />
    </div>
  );
}
