"use client";

import { useEffect, useState } from "react";
import { Calendar, Check, CircleDashed, CircleHelp, Clock, Link2, List, Minus, Search, SearchX, Trash2, TrendingDown, TrendingUp, X } from "lucide-react";
import { Money } from "@/components/Money";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { Chips, FieldGroup } from "@/components/SheetFields";
import { Sheet, SheetBody } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useLang } from "@/hooks/useLang";
import { useChargeAction, useChargeCandidates, useLinkTransaction, useResolveReview, type ChargeAction, type Subscription } from "@/hooks/useSubscriptions";
import { useAccounts } from "@/hooks/useAccounts";
import { useGroups } from "@/hooks/useGroups";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import { parseDateString } from "@/lib/date";
import { formatCurrency, localeOf } from "@/lib/format";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import type { UIKey } from "@/lib/i18n/ui";
import {
  chargeHistory,
  daysBetween,
  GRACE_DAYS,
  lastCharge,
  pendingPriceChange,
  PICK_WINDOW_DAYS,
  type Charge,
  type ChargeStatus,
} from "@/lib/subscriptionReconciliation";
import { toast } from "@/lib/toast";

/** "3 nov", with the year when it isn't this year. */
export function useShortDay() {
  const lang = useLang();
  return (iso: string) => {
    const date = parseDateString(iso.slice(0, 10));
    return date.toLocaleDateString(localeOf(lang), { day: "numeric", month: "short", ...(date.getFullYear() !== new Date().getFullYear() && { year: "numeric" }) });
  };
}

/**
 * Unlinks a transaction from its charge. A shared subscription keeps that charge's expense in its Subcount
 * group: `undo` (reverting a link just made) deletes it too; otherwise a toast offers to delete it.
 */
export function useUnlinkCharge() {
  const t = useTranslations(useLang());
  const link = useLinkTransaction();
  const queryClient = useQueryClient();
  const { data: groups = [] } = useGroups();
  const removeExpense = async (id: string) => {
    await api(`/api/shared/expenses/${id}`, "DELETE");
    await Promise.all([queryKeys.shared.all, queryKeys.subscriptions.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  };
  return async (transactionId: string, { undo = false } = {}) => {
    const result = await link.mutateAsync({ transactionId, subscriptionId: null });
    const expense = result?.group_expense;
    if (!expense) return;
    if (undo) {
      await removeExpense(expense.id).catch(() => toast.error(t("toast.chargeError")));
      return;
    }
    const group = groups.find((g) => g.id === expense.group_id)?.name ?? "Subcount";
    toast.info(interpolate(t("toast.groupExpenseKept"), { group }), {
      description: t("toast.groupExpenseKeptDesc"),
      action: {
        label: t("toast.groupExpenseDelete"),
        onClick: () =>
          void removeExpense(expense.id)
            .then(() => toast(t("toast.groupExpenseDeleted"), { icon: <Trash2 aria-hidden /> }))
            .catch(() => toast.error(t("toast.chargeError"))),
      },
    });
  };
}

const shiftDay = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** Runs a charge decision and confirms it with a toast; `undo` (another decision) goes in its Undo button. */
function useChargeDecision(sub: Subscription) {
  const t = useTranslations(useLang());
  const action = useChargeAction();
  const run = async (kind: ChargeAction, chargeDate: string) => action.mutateAsync({ id: sub.id, action: kind, chargeDate });
  return {
    pending: action.isPending,
    decide: async (kind: ChargeAction, chargeDate: string, done: { title: string; description?: string; undo?: ChargeAction }) => {
      try {
        await run(kind, chargeDate);
        const undo = done.undo;
        toast.success(done.title, {
          description: done.description,
          ...(undo && { action: { label: t("common.undo"), onClick: () => void run(undo, chargeDate).catch(() => toast.error(t("toast.chargeError"), { description: t("toast.chargeErrorDesc") })) } }),
        });
      } catch {
        toast.error(t("toast.chargeError"), { description: t("toast.chargeErrorDesc") });
      }
    },
  };
}

/** What needs deciding about the subscription: an amount other than the saved price, or a charge that didn't show up. */
export function SubscriptionNotices({ sub, onLink }: { sub: Subscription; onLink: (chargeDate: string) => void }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const day = useShortDay();
  const { decide, pending } = useChargeDecision(sub);
  const change = pendingPriceChange(sub);
  const last = lastCharge(sub);
  const missed = last?.status === "missed" ? last : null;
  const review = chargeHistory(sub).find((c) => c.status === "review" && c.review);
  if (!change && !missed && !review) return null;
  const money = (n: number) => formatCurrency(n);

  return (
    <>
      {change && (
        <div className="sf-notice" role="status">
          <span className="sf-notice-icon">{change.diff > 0 ? <TrendingUp aria-hidden /> : <TrendingDown aria-hidden />}</span>
          <div className="sf-notice-body">
            <span className="sf-notice-title">{interpolate(t("notice.price.title"), { name: sub.service_name, amount: money(change.charged), date: day(change.chargeDate) })}</span>
            <span className="sf-notice-text">
              {interpolate(t("notice.price.text"), {
                saved: money(change.saved),
                diff: `${change.diff > 0 ? "+" : "−"}${money(Math.abs(change.diff))}, ${change.diff > 0 ? "+" : "−"}${Math.abs((change.diff / change.saved) * 100).toLocaleString(localeOf(lang), { maximumFractionDigits: 1 })} %`,
                amount: money(change.charged),
              })}
            </span>
            <div className="sf-notice-actions">
              <button
                type="button"
                className="sf-notice-btn sf-notice-btn--primary"
                disabled={pending}
                onClick={() =>
                  decide("accept_price", change.chargeDate, {
                    title: interpolate(t("toast.priceUpdated"), { name: sub.service_name }),
                    description: interpolate(t("toast.priceUpdatedDesc"), { amount: money(change.charged), date: day(change.chargeDate) }),
                    undo: "undo_price",
                  })
                }
              >
                {t("notice.price.accept")}
              </button>
              <button
                type="button"
                className="sf-notice-btn"
                disabled={pending}
                onClick={() =>
                  decide("dismiss_price", change.chargeDate, {
                    title: interpolate(t("toast.priceKept"), { amount: money(change.saved) }),
                    description: interpolate(t("toast.priceKeptDesc"), { date: day(change.chargeDate) }),
                    undo: "undismiss_price",
                  })
                }
              >
                {t("notice.price.dismiss")}
              </button>
            </div>
          </div>
        </div>
      )}
      {review?.review && <ReviewNotice sub={sub} charge={review} />}
      {missed && (
        <div className="sf-notice sf-notice--danger" role="status">
          <span className="sf-notice-icon">
            <SearchX aria-hidden />
          </span>
          <div className="sf-notice-body">
            <span className="sf-notice-title">{interpolate(t("notice.missed.title"), { date: day(missed.date) })}</span>
            <span className="sf-notice-text">
              {interpolate(t("notice.missed.text"), { amount: money(missed.expected), from: day(shiftDay(missed.date, -GRACE_DAYS)), to: day(shiftDay(missed.date, GRACE_DAYS)) })}
            </span>
            <div className="sf-notice-actions">
              <button type="button" className="sf-notice-btn sf-notice-btn--primary" onClick={() => onLink(missed.date)}>
                <Link2 aria-hidden />
                {t("notice.missed.link")}
              </button>
              <button
                type="button"
                className="sf-notice-btn"
                disabled={pending}
                onClick={() => decide("skip", missed.date, { title: t("toast.chargeSkipped"), description: t("toast.chargeSkippedDesc"), undo: "unskip" })}
              >
                {t("notice.missed.skip")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Asks about a transaction that may be one of the charges (automatic matching wasn't sure). */
function ReviewNotice({ sub, charge }: { sub: Subscription; charge: Charge }) {
  const t = useTranslations(useLang());
  const day = useShortDay();
  const resolve = useResolveReview();
  const tx = charge.review!;
  const answer = async (action: "confirm" | "dismiss") => {
    try {
      await resolve.mutateAsync({ transactionId: tx.id, action });
      if (action === "confirm") toast.success(interpolate(t("toast.chargeLinked"), { name: sub.service_name }));
      else toast.success(interpolate(t("toast.reviewDismissed"), { name: sub.service_name }));
    } catch {
      toast.error(t("toast.chargeError"), { description: t("toast.chargeErrorDesc") });
    }
  };
  return (
    <div className="sf-notice sf-notice--accent" role="status">
      <span className="sf-notice-icon">
        <CircleHelp aria-hidden />
      </span>
      <div className="sf-notice-body">
        <span className="sf-notice-title">{interpolate(t("notice.review.title"), { date: day(charge.date) })}</span>
        <span className="sf-notice-text">
          {interpolate(t("notice.review.text"), { desc: tx.bank_description || tx.description || "—", amount: formatCurrency(Number(tx.amount)) })}
        </span>
        <div className="sf-notice-actions">
          <button type="button" className="sf-notice-btn sf-notice-btn--primary" disabled={resolve.isPending} onClick={() => void answer("confirm")}>
            <Check aria-hidden />
            {t("notice.review.confirm")}
          </button>
          <button type="button" className="sf-notice-btn" disabled={resolve.isPending} onClick={() => void answer("dismiss")}>
            {t("notice.review.dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_ICON: Record<ChargeStatus, React.ComponentType<{ strokeWidth?: number }>> = {
  paid: Check,
  changed: TrendingUp,
  pending: Clock,
  missed: X,
  review: CircleHelp,
  skipped: Minus,
  unverified: CircleDashed,
  upcoming: Calendar,
};

const VISIBLE_CHARGES = 5;

/** The subscription's charges, newest first: tap a linked one to open its transaction, an unlinked one to link it. */
export function ChargesGroup({ sub, onLink, onOpenTransaction }: { sub: Subscription; onLink: (chargeDate: string) => void; onOpenTransaction: (id: string) => void }) {
  const t = useTranslations(useLang());
  const day = useShortDay();
  const [all, setAll] = useState(false);
  const charges = chargeHistory(sub);
  const inGroup = new Set((sub.group_expenses ?? []).filter((e) => !e.deleted_at).map((e) => e.subscription_charge_date));
  if (charges.length === 0) return null;
  const past = charges.filter((c) => c.status !== "upcoming").length;
  const shown = all ? charges : charges.slice(0, VISIBLE_CHARGES);

  const statusText = (c: Charge) => {
    const label = t(`charge.${c.status}` as UIKey);
    if (c.status === "upcoming" || (c.status === "unverified" && !inGroup.has(c.date))) return label;
    const detail =
      c.status === "paid" && c.bookedOn
        ? interpolate(t("charge.arrived"), { date: day(c.bookedOn) })
        : c.status === "changed"
          ? (c.tx?.bank_description || c.tx?.description || "")
          : c.status === "review"
            ? (c.review?.bank_description || c.review?.description || "")
          : c.status === "pending"
            ? interpolate(t("charge.until"), { date: day(shiftDay(c.date, GRACE_DAYS)) })
            : "";
    return (
      <>
        <b>{label}</b>
        {detail && ` · ${detail}`}
        {inGroup.has(c.date) && ` · ${t("charge.inGroup")}`}
      </>
    );
  };

  return (
    <FieldGroup title={t("sub.charges")}>
      {shown.map((c) => {
        const Icon = c.status === "changed" && (c.diff ?? 0) < 0 ? TrendingDown : STATUS_ICON[c.status];
        const linkable = !c.tx && !c.review && c.status !== "upcoming";
        const content = (
          <>
            <span className="sf-charge-icon" aria-hidden>
              <Icon strokeWidth={c.status === "paid" || c.status === "missed" ? 2.5 : 2} />
            </span>
            <span className="sf-charge-main">
              <span className="sf-charge-date">{day(c.date)}</span>
              <span className="sf-charge-status">{statusText(c)}</span>
            </span>
            <span className="sf-charge-end">
              <span className={`sf-charge-amount ${c.tx || c.review ? "" : "is-muted"}`}>
                <Money value={c.amount} />
              </span>
              {c.diff !== undefined && (
                <span className="sf-charge-diff">
                  <Money value={c.diff} signed />
                </span>
              )}
              {linkable && c.status !== "skipped" && <span className="sf-charge-link">{t("charge.link")}</span>}
            </span>
          </>
        );
        if (c.tx || c.review) {
          const id = (c.tx ?? c.review)!.id;
          return (
            <button key={c.date} type="button" className="sf-charge" data-status={c.status} onClick={() => onOpenTransaction(id)}>
              {content}
            </button>
          );
        }
        if (linkable) {
          return (
            <button key={c.date} type="button" className="sf-charge" data-status={c.status} onClick={() => onLink(c.date)}>
              {content}
            </button>
          );
        }
        return (
          <div key={c.date} className="sf-charge" data-status={c.status}>
            {content}
          </div>
        );
      })}
      {charges.length > VISIBLE_CHARGES && (
        <button type="button" className="sf-row sf-action sf-action--accent" onClick={() => setAll((v) => !v)}>
          <List aria-hidden />
          <span>{all ? t("sub.chargesLess") : interpolate(t("sub.chargesAll"), { count: past })}</span>
        </button>
      )}
    </FieldGroup>
  );
}

/** Price steps (newest first) with the rise since the start, and a step chart when the price ever changed. */
export function PriceGroup({ sub }: { sub: Subscription }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const day = useShortDay();
  const steps = [...(sub.price_history ?? [])].sort((a, b) => a.valid_from.localeCompare(b.valid_from));
  if (steps.length === 0) return null;
  const change = pendingPriceChange(sub);
  const first = Number(steps[0].cost);
  const current = Number(steps[steps.length - 1].cost);
  const rise = current - first;
  const month = (iso: string) => parseDateString(iso).toLocaleDateString(localeOf(lang), { month: "short", year: "numeric" });
  const pct = first > 0 ? Math.round((rise / first) * 100) : 0;

  return (
    <FieldGroup title={t("sub.price")}>
      <div className="sf-price">
        <div className="sf-price-head">
          <span>{interpolate(t("sub.priceSince"), { date: month(steps[0].valid_from) })}</span>
          <strong className={rise === 0 ? "is-flat" : rise < 0 ? "is-down" : undefined}>
            {rise === 0 ? (
              t("sub.priceFlat")
            ) : (
              <SensitiveAmount>{`${rise > 0 ? "+" : "−"}${formatCurrency(Math.abs(rise))} · ${rise > 0 ? "+" : "−"}${Math.abs(pct)} %`}</SensitiveAmount>
            )}
          </strong>
        </div>
        {(steps.length > 1 || change) && <PriceChart steps={steps.map((s) => ({ day: s.valid_from, cost: Number(s.cost) }))} next={change ? { day: change.chargeDate, cost: change.charged } : null} />}
      </div>
      {[...steps].reverse().map((step) => (
        <div key={step.valid_from} className="sf-row sf-row--info">
          <span className="sf-row-label">{interpolate(t("sub.priceSince"), { date: day(step.valid_from) })}</span>
          <span className="sf-row-value">
            {step.source === "detected" && <span className="sf-badge sf-badge--muted">{t("sub.priceDetected")}</span>}
            <Money value={Number(step.cost)} />
          </span>
        </div>
      ))}
    </FieldGroup>
  );
}

/** Step line of the price over time; `next` is a charged amount not accepted yet (dashed). */
function PriceChart({ steps, next }: { steps: { day: string; cost: number }[]; next: { day: string; cost: number } | null }) {
  const lang = useLang();
  const W = 320;
  const H = 118;
  const left = 12;
  const right = W - 12;
  const top = 26;
  const bottom = 100;
  const today = new Date().toISOString().slice(0, 10);
  const start = steps[0].day;
  const end = [today, next?.day ?? today].sort().at(-1)!;
  const span = Math.max(1, daysBetween(start, end));
  const x = (iso: string) => left + (Math.min(span, Math.max(0, daysBetween(start, iso))) / span) * (right - left);
  const values = [...steps.map((s) => s.cost), ...(next ? [next.cost] : [])];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(0.5, (hi - lo) * 0.25);
  const y = (v: number) => bottom - ((v - (lo - pad)) / (hi + pad - (lo - pad))) * (bottom - top);
  const money = (v: number) => formatCurrency(v);

  let line = `M${x(steps[0].day)} ${y(steps[0].cost)}`;
  for (const step of steps.slice(1)) line += ` H${x(step.day)} V${y(step.cost)}`;
  const last = steps[steps.length - 1];
  line += ` H${x(next?.day ?? end)}`;
  const area = `${line} V${bottom} H${x(steps[0].day)} Z`;
  const years = [];
  for (let year = Number(start.slice(0, 4)) + 1; year <= Number(end.slice(0, 4)); year++) years.push(year);
  const label = (iso: string) => parseDateString(iso).toLocaleDateString(localeOf(lang), { month: "short", year: "numeric" });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={steps.map((s) => `${money(s.cost)} · ${label(s.day)}`).join(", ")}>
      <line className="sf-price-grid" x1={left} x2={right} y1={bottom} y2={bottom} />
      <path className="sf-price-area" d={area} />
      <path className="sf-price-line" d={line} />
      {next && <path className="sf-price-next" d={`M${x(next.day)} ${y(last.cost)} V${y(next.cost)} H${right}`} />}
      {steps.map((s, i) => (
        <g key={s.day}>
          <circle className="sf-price-dot" cx={x(s.day)} cy={y(s.cost)} r={3.5} />
          <text className="sf-price-val" x={Math.min(x(s.day) + 4, right - 40)} y={y(s.cost) - 7} textAnchor={i === steps.length - 1 && !next && x(s.day) > right - 50 ? "end" : "start"}>
            {money(s.cost)}
          </text>
        </g>
      ))}
      {next && (
        <>
          <circle className="sf-price-dot is-next" cx={x(next.day)} cy={y(next.cost)} r={3.5} />
          <text className="sf-price-val is-next" x={right} y={y(next.cost) - 9} textAnchor="end">
            {money(next.cost)}?
          </text>
        </>
      )}
      <text className="sf-price-ax" x={left} y={H - 4}>
        {label(start)}
      </text>
      {years
        .filter((year) => x(`${year}-01-01`) - left > 40)
        .map((year) => (
          <text key={year} className="sf-price-ax" x={x(`${year}-01-01`)} y={H - 4} textAnchor="middle">
            {year}
          </text>
        ))}
    </svg>
  );
}

/** Pick the transaction that paid a charge: candidates around its date, best first, or a search. */
export function ChargePickerSheet({ sub, chargeDate, onOpenChange }: { sub: Subscription; chargeDate: string | null; onOpenChange: (open: boolean) => void }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const day = useShortDay();
  const { data: accounts = [] } = useAccounts();
  const [all, setAll] = useState(false);
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQ(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const { data: candidates = [], isFetching } = useChargeCandidates(sub.id, chargeDate, { all, q });
  const link = useLinkTransaction();
  const unlink = useUnlinkCharge();
  const account = accounts.find((a) => a.id === sub.account_id);
  const expected = chargeDate ? chargeHistory(sub).find((c) => c.date === chargeDate)?.expected ?? Number(sub.cost) : 0;

  const pick = async (id: string) => {
    if (!chargeDate) return;
    try {
      await link.mutateAsync({ transactionId: id, subscriptionId: sub.id, chargeDate });
      onOpenChange(false);
      toast.success(interpolate(t("toast.chargeLinked"), { name: sub.service_name }), {
        action: { label: t("common.undo"), onClick: () => void unlink(id, { undo: true }).catch(() => toast.error(t("toast.chargeError"))) },
      });
    } catch (error) {
      toast.error(error instanceof Error && error.message === "charge_taken" ? t("link.chargeTaken") : t("toast.chargeError"));
    }
  };

  const reasonKey = (reason: string | null) => (reason ? (`match.${reason}` as UIKey) : null);

  return (
    <Sheet
      open={!!chargeDate}
      onOpenChange={onOpenChange}
      title={chargeDate ? interpolate(t("picker.title"), { date: day(chargeDate) }) : ""}
      description={interpolate(t("picker.desc"), { name: sub.service_name, amount: formatCurrency(expected) })}
    >
      <SheetBody>
        <div className="sf-logo-search">
          <Search aria-hidden />
          <input id="charge-picker-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("picker.search")} aria-label={t("picker.search")} autoComplete="off" />
        </div>
        {account && (
          <Chips
            scroll
            label={t("sub.account")}
            value={all ? "all" : "own"}
            onChange={(v) => setAll(v === "all")}
            options={[
              { value: "own", label: account.name, color: account.color || "var(--accent)", icon: <span className="sf-chip-dot" aria-hidden /> },
              { value: "all", label: t("picker.allAccounts") },
            ]}
          />
        )}
        <FieldGroup
          title={q ? t("picker.results") : t("picker.best")}
          hint={!q && chargeDate ? interpolate(t("picker.hint"), { from: day(shiftDay(chargeDate, -PICK_WINDOW_DAYS)), to: day(shiftDay(chargeDate, PICK_WINDOW_DAYS)) }) : undefined}
        >
          {candidates.length === 0 ? (
            <p className="sf-row sf-hint">{isFetching ? <Spinner className="size-4" /> : t("picker.empty")}</p>
          ) : (
            candidates.map((tx) => {
              const reason = reasonKey(tx.reason);
              return (
                <button key={tx.id} type="button" className="lp-row" disabled={link.isPending} onClick={() => pick(tx.id)}>
                  <span className="lp-main">
                    <span className="lp-title">
                      <span>{tx.bank_description || tx.description || "—"}</span>
                    </span>
                    <span className="lp-meta">
                      <span>{day(tx.date)}</span>
                      {tx.account && (
                        <>
                          <span className="lp-meta-sep">·</span>
                          <span className="lp-dot" style={{ backgroundColor: tx.account.color || "var(--gris-claro)" }} />
                          <span className="lp-truncate">{tx.account.name}</span>
                        </>
                      )}
                    </span>
                  </span>
                  <span className="lp-end">
                    <span className="lp-amount is-expense">
                      <Money value={-Number(tx.amount)} />
                    </span>
                    {reason && <span className={`lp-match ${tx.reason === "strong" ? "lp-match--strong" : ""}`}>{t(reason)}</span>}
                  </span>
                </button>
              );
            })
          )}
        </FieldGroup>
      </SheetBody>
    </Sheet>
  );
}
