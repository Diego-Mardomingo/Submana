"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Landmark, Loader2, Plus, Repeat, Split, Wallet, X } from "lucide-react";
import CalendarAccountFilter from "@/components/CalendarAccountFilter";
import { HeaderBell } from "@/components/notifications/NotificationBell";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { useFrequencyLabel } from "@/components/SubscriptionDialogs";
import { SubscriptionIcon, useDateLabels } from "@/components/SubscriptionsBody";
import { SubscriptionSheet } from "@/components/SubscriptionSheet";
import { signed, TransactionRow, transactionEmoji } from "@/components/TransactionDayList";
import { TransactionSheet } from "@/components/TransactionSheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCalendarAccountFilter } from "@/contexts/CalendarFilterContext";
import { useJointAccountIds } from "@/hooks/useAccounts";
import { useBudgets } from "@/hooks/useBudgets";
import { useCategories, useCategoryLookup } from "@/hooks/useCategories";
import { useSharedBalances } from "@/hooks/useGroups";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery, useMounted } from "@/hooks/useMediaQuery";
import { useProfile } from "@/hooks/useProfile";
import { useSubscriptions, type Subscription } from "@/hooks/useSubscriptions";
import { useSwipe } from "@/hooks/useSwipe";
import { useTransactions, type Transaction } from "@/hooks/useTransactions";
import { appNow, calendarDayInAppTimeZone, monthKey, shiftMonth } from "@/lib/date";
import { formatCurrency, localeOf, monthName } from "@/lib/format";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { initialsAvatarDataUri } from "@/lib/initialsAvatar";
import { metricTransactions, sumByType } from "@/lib/metricsFilters";
import { fromCents } from "@/lib/shared/splits";
import { heatLevels } from "@/lib/spendHeat";
import { isPaymentDay, isSubscriptionActive, nextPaymentDate } from "@/lib/subscriptions";
import { cn } from "@/lib/utils";

type Month = { year: number; month: number };
type DayData = { day: number; subs: Subscription[]; txs: Transaction[] };
type PendingItem = { key: string; href: string; icon: React.ReactNode; color: string; title: React.ReactNode; hint: React.ReactNode; action: string };

const currentMonth = (): Month => ({ year: appNow().getFullYear(), month: appNow().getMonth() + 1 });
/** Sortable yyyymmdd number, to compare days without building dates. */
const stamp = (year: number, month: number, day: number) => year * 10000 + month * 100 + day;
/** 2024-01-01 was a Monday: the week starts on Monday. */
const WEEK = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i));
/** A budget shows up as pending from this share of its limit. */
const BUDGET_ALERT_RATIO = 0.9;
const UPCOMING_COUNT = 3;

/** A translated sentence with its `{amount}` placeholder rendered as a (blurrable) amount. */
function withAmount(text: string, amount: number, strong = false) {
  const [before, after = ""] = text.split("{amount}");
  const value = <SensitiveAmount>{formatCurrency(amount)}</SensitiveAmount>;
  return (
    <>
      {before}
      {strong ? <b>{value}</b> : value}
      {after}
    </>
  );
}

/** Subscription logos of a day: up to two, or the first one plus "+N". */
function DayLogos({ subs }: { subs: Subscription[] }) {
  if (subs.length === 0) return null;
  const shown = subs.length > 2 ? subs.slice(0, 1) : subs;
  return (
    <span className="home-day-logos" aria-hidden>
      {shown.map((sub) => (
        // eslint-disable-next-line @next/next/no-img-element -- remote service logos
        <img key={sub.id} src={sub.icon || initialsAvatarDataUri(sub.service_name)} alt="" className="home-day-logo" />
      ))}
      {subs.length > 2 && <span className="home-day-more">+{subs.length - 1}</span>}
    </span>
  );
}

/**
 * Home: the month as a calendar where each past day is tinted by how much was spent and carries its
 * subscription charges, then the month's balance, what is waiting on the user and the next charges.
 * Picking a day opens its agenda under the calendar, where its movements can be opened or added.
 */
export default function CalendarBody() {
  const lang = useLang();
  const es = lang === "es";
  const t = useTranslations(lang);
  const freqLabel = useFrequencyLabel();
  const dates = useDateLabels();
  const mounted = useMounted();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [view, setView] = useState(currentMonth);
  const [picked, setPicked] = useState<number | null>(null);
  const [pendingOpen, setPendingOpen] = useState<boolean | null>(null);
  const [swipeArea, setSwipeArea] = useState<HTMLElement | null>(null);
  const agendaRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [creating, setCreating] = useState(false);
  const [openSub, setOpenSub] = useState<Subscription | null>(null);

  const today = currentMonth();
  const previous = shiftMonth(view.year, view.month, -1);
  const { data: subscriptions = [] } = useSubscriptions();
  const { data: transactions = [], isLoading, isFetching, isPlaceholderData } = useTransactions(view.year, view.month);
  const previousMonth = useTransactions(previous.year, previous.month);
  const { data: thisMonthTransactions = [] } = useTransactions(today.year, today.month);
  const { data: budgets = [] } = useBudgets();
  const { data: profile } = useProfile();
  const { data: balances } = useSharedBalances(!!profile);
  const { data: categories } = useCategories();
  const jointAccountIds = useJointAccountIds();
  const categoryLookup = useCategoryLookup();
  const { isAccountHidden } = useCalendarAccountFilter();

  const goTo = (target: Month) => {
    setView(target);
    setPicked(null);
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
  const isFuture = (day: number) => todayStamp !== null && stamp(view.year, view.month, day) > todayStamp;

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
  const counted = days.map((entry) => entry.txs.filter((tx) => countedIds.has(tx.id)));
  const heat = heatLevels(counted.map((txs) => sumByType(txs).expense));

  // The month in figures, with the same accounts the calendar shows.
  const { income, expense } = sumByType(counted.flat());
  const balance = income - expense;
  const hasMovements = income > 0 || expense > 0;

  // Spending against the previous month: up to the same day while the month is running, whole months otherwise.
  const cutoffDay = isCurrent && now ? now.getDate() : 31;
  const previousExpense =
    previousMonth.data && !previousMonth.isPlaceholderData
      ? sumByType(
          metricTransactions(previousMonth.data, categories, { jointAccountIds }).filter(
            (tx) => !isAccountHidden(tx.account_id) && Number(calendarDayInAppTimeZone(tx.date).slice(8)) <= cutoffDay
          )
        ).expense
      : 0;
  const difference = !monthLoading && expense > 0 && previousExpense > 0 ? expense - previousExpense : 0;
  const comparison =
    Math.abs(difference) >= 1
      ? withAmount(
          interpolate(t(`home.vs${difference < 0 ? "Less" : "More"}${isCurrent ? "" : "Full"}`), {
            amount: "{amount}",
            month: monthName(previous.month, lang, "long").toLowerCase(),
            day: cutoffDay,
          }),
          Math.abs(difference),
          true
        )
      : null;

  // What is waiting on the user: bank movements to review, budgets about to run out, shared debts.
  const reviewCount = thisMonthTransactions.filter((tx) => tx.review_match_id).length;
  const pending: PendingItem[] = [];
  if (reviewCount > 0) {
    pending.push({
      key: "review",
      href: "/transactions",
      icon: <Landmark className="size-[18px]" strokeWidth={2} />,
      color: "var(--info)",
      title: interpolate(t(reviewCount === 1 ? "home.reviewOne" : "home.reviewMany"), { count: reviewCount }),
      hint: t("home.reviewHint"),
      action: t("home.review"),
    });
  }
  for (const budget of budgets) {
    const limit = Number(budget.amount);
    const spent = Number(budget.spent ?? 0);
    if (limit <= 0 || spent / limit < BUDGET_ALERT_RATIO) continue;
    const roots = budget.categoryIds.filter((id) => !budget.categoryIds.includes(categoryLookup.parent.get(id) ?? ""));
    const name = roots.map((id) => categoryLookup.name.get(id)).filter(Boolean).join(", ") || t("budgets.generalBudget");
    pending.push({
      key: `budget-${budget.id}`,
      href: "/budgets",
      icon: (roots.length === 1 && categoryLookup.emoji.get(roots[0])) || <Wallet className="size-[18px]" strokeWidth={2} />,
      color: spent > limit ? "var(--danger)" : "var(--warning)",
      title: interpolate(t("budgets.warning"), { name, pct: Math.round((spent / limit) * 100) }),
      hint: withAmount(t(spent > limit ? "home.budgetOver" : "home.budgetLeft"), Math.abs(limit - spent)),
      action: t("home.see"),
    });
  }
  if (balances && balances.owed_to_me_cents > 0) {
    pending.push({
      key: "owed",
      href: "/subcount",
      icon: <Split className="size-[18px]" strokeWidth={2} />,
      color: "var(--success)",
      title: withAmount(t("home.owedToYou"), fromCents(balances.owed_to_me_cents)),
      hint: t("nav.groups"),
      action: t("home.settle"),
    });
  }
  if (balances && balances.i_owe_cents > 0) {
    pending.push({
      key: "owe",
      href: "/subcount",
      icon: <Split className="size-[18px]" strokeWidth={2} />,
      color: "var(--accent)",
      title: withAmount(t("home.youOwe"), fromCents(balances.i_owe_cents)),
      hint: t("nav.groups"),
      action: t("home.settle"),
    });
  }

  // Next charges from today on, whatever month is on screen.
  const upcoming = mounted
    ? subscriptions
        .filter((sub) => !isAccountHidden(sub.account_id) && isSubscriptionActive(sub))
        .flatMap((sub) => {
          const date = nextPaymentDate(sub);
          return date ? [{ sub, date }] : [];
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime() || Number(b.sub.cost) - Number(a.sub.cost))
        .slice(0, UPCOMING_COUNT)
    : [];
  // Still to be charged before the month ends (only meaningful for the running month).
  const toCharge = isCurrent ? days.reduce((sum, entry) => (isFuture(entry.day) ? sum + entry.subs.reduce((s, sub) => s + Number(sub.cost), 0) : sum), 0) : 0;

  const selected = picked === null ? null : Math.min(picked, daysInMonth);
  const selectedDay = selected === null ? null : days[selected - 1];
  const selectedDate = selected === null ? undefined : new Date(view.year, view.month - 1, selected, 12);

  /** Picking a day opens its agenda; picking it again closes it. */
  const pick = (day: number) => {
    if (day === selected) return setPicked(null);
    setPicked(day);
    // On phones the agenda sits below the grid: bring it into view when it is mostly hidden.
    requestAnimationFrame(() => {
      const agenda = agendaRef.current;
      if (agenda && agenda.getBoundingClientRect().top > window.innerHeight - 180) agenda.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const locale = localeOf(lang);
  const dayLabel = (() => {
    if (!selectedDate) return null;
    const date = selectedDate.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "short" });
    if (!now) return { title: date };
    const offset = Math.round((selectedDate.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime()) / 86_400_000);
    const relative = offset === 0 ? t("common.today") : offset === -1 ? t("home.yesterday") : offset === 1 ? t("home.tomorrow") : null;
    return relative ? { title: relative, detail: date } : { title: date };
  })();
  const dayNet = selected === null ? 0 : counted[selected - 1].reduce((sum, tx) => sum + (tx.type === "income" ? 1 : -1) * Number(tx.amount), 0);
  const subStatus = (day: number) => {
    const s = stamp(view.year, view.month, day);
    if (todayStamp === null) return null;
    if (s === todayStamp) return { label: t("home.chargedToday"), soon: true };
    return s < todayStamp ? { label: t("home.charged"), soon: false } : { label: t("home.upcomingCharge"), soon: true };
  };

  const firstWeekday = new Date(view.year, view.month - 1, 1).getDay() || 7;
  const liveSub = openSub ? (subscriptions.find((s) => s.id === openSub.id) ?? openSub) : null;
  const viewMonthName = monthName(view.month, lang, "long");

  return (
    <div className="page-container lp-page home-page fade-in">
      <div className="home-layout">
        <section ref={setSwipeArea} className="home-cal" aria-label={t("home.calendar")}>
          <header className="home-top">
            <h1>
              {viewMonthName} <span>{view.year}</span>
            </h1>
            {isFetching && monthLoading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label={t("home.loading")} />
            ) : (
              mounted &&
              !isCurrent && (
                <button type="button" className="lp-chip" onClick={goToToday}>
                  {t("common.today")}
                </button>
              )
            )}
            <div className="home-top-actions">
              <button type="button" className="lp-icon-btn" onClick={() => changeMonth(-1)} aria-label={t("home.previousMonth")}>
                <ChevronLeft className="size-5" strokeWidth={2} />
              </button>
              <button type="button" className="lp-icon-btn" onClick={() => changeMonth(1)} aria-label={t("home.nextMonth")}>
                <ChevronRight className="size-5" strokeWidth={2} />
              </button>
              <CalendarAccountFilter />
              <HeaderBell />
            </div>
          </header>

          <div className="home-weekdays" aria-hidden>
            {WEEK.map((date) => (
              <span key={date.getDay()}>
                <span className="home-weekday-narrow">{date.toLocaleDateString(locale, { weekday: "narrow" })}</span>
                <span className="home-weekday-short">{date.toLocaleDateString(locale, { weekday: "short" }).replace(".", "")}</span>
              </span>
            ))}
          </div>
          <div className="home-grid lp-fade" key={`grid-${key}`} role="group" aria-label={`${viewMonthName} ${view.year}`}>
            {days.map((entry) => {
              const future = isFuture(entry.day);
              const hasIncome = counted[entry.day - 1].some((tx) => tx.type === "income");
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
                  className={cn("home-day", future ? "is-future" : `heat-${heat[entry.day - 1]}`, isToday && "is-today", isSelected && "is-selected", hasIncome && "has-income")}
                  style={entry.day === 1 ? { gridColumnStart: firstWeekday } : undefined}
                  aria-pressed={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={[date, ...activity].join(", ")}
                  onClick={() => pick(entry.day)}
                >
                  <span className="home-day-num">{entry.day}</span>
                  <DayLogos subs={entry.subs} />
                </button>
              );
            })}
          </div>
          <div className="home-key" aria-hidden>
            {t("home.keyLess")}
            {[1, 2, 3, 4].map((level) => (
              <i key={level} className={`heat-${level}`} />
            ))}
            {t("home.keyMore")}
            <span className="home-key-income" />
            {t("transactions.income")}
          </div>

          {selected !== null && selectedDay && dayLabel && (
            <div ref={agendaRef} className="home-agenda lp-fade" key={`${key}-${selected}`} role="region" aria-label={t("home.dayAgenda")}>
              <div className="home-agenda-head">
                <span className="home-agenda-title">
                  {dayLabel.title}
                  {dayLabel.detail && <small>{dayLabel.detail}</small>}
                </span>
                {!monthLoading && dayNet !== 0 && (
                  <span className={cn("home-agenda-net", dayNet > 0 && "is-income")}>
                    <SensitiveAmount>{signed(dayNet)}</SensitiveAmount>
                  </span>
                )}
                <button type="button" className="lp-icon-btn home-agenda-close" onClick={() => setPicked(null)} aria-label={t("home.closeDay")}>
                  <X className="size-[18px]" strokeWidth={2} />
                </button>
              </div>
              <div className="home-rows">
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
                          <Repeat className="home-meta-icon" strokeWidth={2.5} aria-hidden />
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
                {!monthLoading &&
                  selectedDay.txs.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      emoji={transactionEmoji(categoryLookup, tx)}
                      fallbackLabel={t(tx.type === "income" ? "transactions.income" : "transactions.expense")}
                      onOpen={setEditing}
                      excluded={!countedIds.has(tx.id)}
                    />
                  ))}
              </div>
              {!monthLoading && selectedDay.subs.length === 0 && selectedDay.txs.length === 0 && (
                <p className="home-agenda-empty">{t(isFuture(selected) ? "home.nothingPlanned" : "home.nothingThatDay")}</p>
              )}
              <button type="button" className="home-add" onClick={() => setCreating(true)}>
                <Plus className="size-4" strokeWidth={2.5} aria-hidden />
                {t("transactions.add")}
              </button>
            </div>
          )}
        </section>

        <div className="home-side">
          <section className="home-summary" aria-label={t("home.summary")}>
            <p className="home-label">{interpolate(t("home.balanceOf"), { month: es ? viewMonthName.toLowerCase() : viewMonthName })}</p>
            <p className={cn("home-balance", hasMovements && (balance > 0 ? "is-income" : balance < 0 && "is-negative"), !hasMovements && "is-muted")}>
              <SensitiveAmount>{balance === 0 ? formatCurrency(0) : signed(balance)}</SensitiveAmount>
            </p>
            <div className="home-pair">
              <div>
                <span>{t("home.spent")}</span>
                <b>
                  <SensitiveAmount>{formatCurrency(expense)}</SensitiveAmount>
                </b>
              </div>
              <div>
                <span>{t("home.received")}</span>
                <b>
                  <SensitiveAmount>{formatCurrency(income)}</SensitiveAmount>
                </b>
              </div>
            </div>
            {comparison && <p className="home-vs">{comparison}</p>}
          </section>

          {pending.length > 0 && (
            <Collapsible open={pendingOpen ?? isDesktop} onOpenChange={setPendingOpen} className="home-pending">
              <CollapsibleTrigger className="home-pending-trigger">
                <span className="home-pending-count">{pending.length}</span>
                {t("home.pending")}
                <ChevronRight className="home-pending-chevron size-4" strokeWidth={2.25} aria-hidden />
              </CollapsibleTrigger>
              <CollapsibleContent className="subs-collapsible-content">
                <div className="subs-collapsible-inner home-rows">
                  {pending.map((item) => (
                    <Link key={item.key} href={item.href} className="lp-row">
                      <span className="lp-icon" style={{ color: item.color, background: `color-mix(in srgb, ${item.color} 16%, transparent)` }} aria-hidden>
                        {item.icon}
                      </span>
                      <span className="lp-main">
                        <span className="lp-title">
                          <span>{item.title}</span>
                        </span>
                        <span className="lp-meta">
                          <span className="lp-truncate">{item.hint}</span>
                        </span>
                      </span>
                      <span className="home-go">{item.action}</span>
                    </Link>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {upcoming.length > 0 && (
            <section aria-label={t("home.upcoming")}>
              <div className="home-section-head">
                <p className="home-label">{t("home.upcoming")}</p>
                {toCharge > 0 && <span className="home-section-aside">{withAmount(t("home.untilMonthEnd"), toCharge, true)}</span>}
              </div>
              <div className="home-dues">
                {upcoming.map(({ sub, date }) => (
                  <button key={sub.id} type="button" className="home-due" onClick={() => setOpenSub(sub)}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote service logos */}
                    <img src={sub.icon || initialsAvatarDataUri(sub.service_name)} alt="" className="home-due-logo" />
                    <span className="home-due-name">{sub.service_name}</span>
                    <span className="home-due-when">{dates.relative(date)}</span>
                    <span className="home-due-amount">
                      <SensitiveAmount>{formatCurrency(Number(sub.cost))}</SensitiveAmount>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <TransactionSheet open={creating} onOpenChange={setCreating} defaultDate={selectedDate} />
      <TransactionSheet open={!!editing} onOpenChange={(open) => !open && setEditing(null)} transaction={editing} />
      <SubscriptionSheet open={!!openSub} onOpenChange={(open) => !open && setOpenSub(null)} subscription={liveSub} />
    </div>
  );
}
