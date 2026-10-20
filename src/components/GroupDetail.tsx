"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeftRight, ArrowRight, Check, ChevronLeft, HandCoins, Pencil, Plus, Receipt, Settings2, Trash2, UserMinus, UserPlus } from "lucide-react";
import { toast } from "@/lib/toast";
import { ConfirmDeleteSheet } from "@/components/ConfirmSheet";
import { HeaderBell } from "@/components/notifications/NotificationBell";
import { AvatarStack, NetAmount, signedMoney, toneClass } from "@/components/GroupsBody";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { SettleUpSheet } from "@/components/SettleUpSheet";
import { Chips, DeleteAction, FieldGroup, FieldRow, FieldStack, FormError, RowInput, Segmented, SheetButton } from "@/components/SheetFields";
import { SharedExpenseSheet } from "@/components/SharedExpenseSheet";
import { useMemberLabel } from "@/components/SplitEditor";
import { SwipeToReveal, SwipeToRevealGroup } from "@/components/SwipeToReveal";
import { Sheet, SheetBody, SheetFooter, SheetForm } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useFriends } from "@/hooks/useFriends";
import { useAddGroupMember, useDeleteGroup, useGroup, useRemoveGroupMember, useUpdateGroup } from "@/hooks/useGroups";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { isMuted, useNotificationMutes, useToggleMute } from "@/hooks/useNotifications";
import { useUrlParam } from "@/hooks/useUrlParam";
import { useDeleteSharedExpense, useUndoableDeleteSharedExpense } from "@/hooks/useSharedExpenses";
import { useProfile } from "@/hooks/useProfile";
import { parseIdParam } from "@/lib/deepLinks";
import { appNow, parseDateString, toAppDate, toDateString } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import type { Transfer } from "@/lib/shared/debts";
import { sharedErrorText } from "@/lib/shared/errorText";
import { fromCents } from "@/lib/shared/splits";
import type { GroupDetailData, SharedEventItem, SharedExpenseItem, SharedProfile } from "@/lib/shared/types";
import { cn } from "@/lib/utils";

type Tab = "expenses" | "balances" | "activity";
export const PAGE = 30;

const money = (n: number) => <SensitiveAmount>{formatCurrency(n)}</SensitiveAmount>;

export function GroupSettingsSheet({ open, onOpenChange, data, meId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: GroupDetailData;
  meId: string;
}) {
  const t = useTranslations(useLang());
  const label = useMemberLabel(meId);
  const { data: friends } = useFriends(open);
  const rename = useUpdateGroup({ silentError: true }); // the form shows the error inline
  const update = useUpdateGroup();
  const add = useAddGroupMember();
  const remove = useRemoveGroupMember();
  const deleteGroup = useDeleteGroup();
  const { data: mutes } = useNotificationMutes(open);
  const toggleMute = useToggleMute();
  const router = useRouter();
  const [name, setName] = useState(data.group.name);
  const [error, setError] = useState("");
  const archived = !!data.group.archived_at;
  const memberIds = new Set(data.members.map((m) => m.user_id));
  const addable = (friends?.friends ?? []).filter((f) => !memberIds.has(f.profile.user_id));
  const muted = isMuted(mutes, "group", data.group.id);
  const setMuted = (next: boolean) =>
    toggleMute.mutate(
      { target_type: "group", target_id: data.group.id, muted: next },
      { onSuccess: () => toast.info(t(next ? "mute.groupMuted" : "mute.groupUnmuted")) }
    );

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError(t("groups.error.invalid_name"));
    try {
      await rename.mutateAsync({ id: data.group.id, name: name.trim() });
      toast.success(t("groups.saved"));
      onOpenChange(false);
    } catch (err) {
      setError(sharedErrorText(t, err instanceof Error ? err.message : undefined));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("groups.settings")}>
      <SheetForm onSubmit={save}>
        <SheetBody>
          <FieldGroup>
            <FieldRow label={t("groups.name")} htmlFor="group-rename">
              <RowInput id="group-rename" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </FieldRow>
          </FieldGroup>

          <FieldGroup hint={t("mute.hint")}>
            <FieldRow label={t("mute.group")} htmlFor="group-mute">
              <Switch id="group-mute" checked={muted} onCheckedChange={setMuted} disabled={!mutes} />
            </FieldRow>
          </FieldGroup>

          <FieldGroup title={t("groups.members")} hint={t("groups.removeHint")}>
            <div className="lp-group">
              {data.members.map((m) => (
                <div key={m.user_id} className="lp-row lp-row--static">
                  <ProfileAvatar name={m.display_name} url={m.avatar_url} size={32} />
                  <span className="lp-main">
                    <span className="lp-title">
                      <span>{label(m)}</span>
                    </span>
                    <span className="lp-meta">
                      <span className="lp-truncate">@{m.handle}</span>
                    </span>
                  </span>
                  <button
                    type="button"
                    className="lp-icon-btn"
                    aria-label={m.user_id === meId ? t("groups.leave") : t("groups.removeMember")}
                    title={m.user_id === meId ? t("groups.leave") : t("groups.removeMember")}
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate(
                        { groupId: data.group.id, userId: m.user_id },
                        {
                          onSuccess: () => {
                            if (m.user_id !== meId) return;
                            toast.info(t("groups.left"));
                            onOpenChange(false);
                          },
                        }
                      )
                    }
                  >
                    <UserMinus className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </FieldGroup>

          {addable.length > 0 && !archived && (
            <FieldGroup title={t("groups.addMember")}>
              <FieldStack>
                <Chips
                  label={t("groups.addMember")}
                  value=""
                  onChange={(userId) => add.mutate({ groupId: data.group.id, userId })}
                  options={addable.map((f) => ({
                    value: f.profile.user_id,
                    label: f.profile.display_name,
                    icon: <ProfileAvatar name={f.profile.display_name} url={f.profile.avatar_url} size={18} />,
                  }))}
                />
              </FieldStack>
            </FieldGroup>
          )}

          <FieldGroup>
            {archived ? (
              <SheetButton type="button" variant="ghost" onClick={() => update.mutate({ id: data.group.id, archived: false })}>
                {t("groups.unarchive")}
              </SheetButton>
            ) : (
              <DeleteAction
                tone="warn"
                label={t("groups.archive")}
                confirmTitle={t("groups.archiveTitle")}
                confirmText={t("groups.archiveDesc")}
                pending={update.isPending}
                onConfirm={async () => {
                  try {
                    await update.mutateAsync({ id: data.group.id, archived: true });
                  } catch {
                    return; // the error toast is already up; keep the confirmation to retry
                  }
                  toast(t("groups.archivedToast"), {
                    icon: <Archive />,
                    action: { label: t("common.undo"), onClick: () => update.mutate({ id: data.group.id, archived: false }) },
                  });
                  onOpenChange(false);
                }}
              />
            )}
            <DeleteAction
              label={t("groups.delete")}
              confirmTitle={t("groups.deleteTitle")}
              confirmText={t(data.transfers.length > 0 ? "groups.deleteDescDebts" : "groups.deleteDesc")}
              pending={deleteGroup.isPending}
              onConfirm={async () => {
                try {
                  await deleteGroup.mutateAsync(data.group.id);
                } catch {
                  return; // the error toast is already up
                }
                onOpenChange(false);
                router.replace("/subcount");
              }}
            />
          </FieldGroup>
        </SheetBody>
        <SheetFooter>
          <FormError>{error}</FormError>
          <SheetButton type="submit" pending={update.isPending}>
            {t("common.save")}
          </SheetButton>
        </SheetFooter>
      </SheetForm>
    </Sheet>
  );
}

function ExpenseRow({ expense, meId, profiles, highlighted, onOpen, onDelete }: {
  expense: SharedExpenseItem;
  meId: string;
  /** Picked out for a moment: the expense a notification points to. */
  highlighted?: boolean;
  profiles: Map<string, SharedProfile>;
  onOpen: (expense: SharedExpenseItem) => void;
  onDelete: (expense: SharedExpenseItem) => void;
}) {
  const t = useTranslations(useLang());
  const payer = profiles.get(expense.paid_by);
  const settlement = expense.kind === "settlement";
  const receiverId = settlement ? (expense.shares[0]?.user_id ?? "") : "";
  const total = formatCurrency(expense.total_amount);
  const { cents: impact, involved } = myImpact(expense, meId);

  const title = !settlement
    ? expense.title
    : expense.paid_by === meId
      ? interpolate(t("shared.settlementYouPaid"), { name: profiles.get(receiverId)?.display_name ?? "?" })
      : receiverId === meId
        ? interpolate(t("shared.settlementPaidYou"), { name: payer?.display_name ?? "?" })
        : interpolate(t("shared.settlementOthers"), { from: payer?.display_name ?? "?", to: profiles.get(receiverId)?.display_name ?? "?" });
  const meta = settlement
    ? t("shared.settlement")
    : expense.paid_by === meId
      ? interpolate(t("shared.youPaidTotal"), { amount: total })
      : interpolate(t("shared.paidByTotal"), { name: payer?.display_name ?? "?", amount: total });

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <SwipeToReveal
      id={expense.id}
      className="lp-swipe lp-swipe--2"
      desktopMinWidth={1024}
      actions={
        <>
          {!settlement && (
            <button type="button" onClick={stop(() => onOpen(expense))} className="lp-action lp-action--edit" aria-label={t("shared.edit")}>
              <Pencil className="size-5" />
            </button>
          )}
          <button
            type="button"
            onClick={stop(() => onDelete(expense))}
            className="lp-action lp-action--danger"
            aria-label={t(settlement ? "shared.settlementUndo" : "shared.delete")}
          >
            <Trash2 className="size-5" />
          </button>
        </>
      }
    >
      <button type="button" className={`lp-row ${highlighted ? "lp-row--highlight" : ""}`} onClick={() => onOpen(expense)}>
        <span className={cn("lp-icon sc-tile", settlement && "sc-tile--settle")} aria-hidden>
          {settlement ? <ArrowLeftRight size={18} /> : <Receipt size={18} />}
          {!settlement && payer && <ProfileAvatar name={payer.display_name} url={payer.avatar_url} size={18} className="sc-tile-payer" />}
        </span>
        <span className="lp-main">
          <span className="lp-title">
            <span>{title}</span>
          </span>
          <span className="lp-meta">
            <span className="lp-truncate">{meta}</span>
          </span>
        </span>
        <span className="lp-end">
          {settlement ? (
            involved ? <span className="lp-amount">{money(expense.total_amount)}</span> : <span className="sc-muted-note">{t("shared.notAffected")}</span>
          ) : !involved ? (
            <span className="sc-muted-note">{t("shared.notInvolved")}</span>
          ) : impact === 0 ? (
            <span className="sc-muted-note">{t("shared.notAffected")}</span>
          ) : (
            <>
              <NetAmount cents={impact} />
              <span className={cn("sc-dir", toneClass(impact))}>{t(impact > 0 ? "shared.youLent" : "shared.youBorrowed")}</span>
            </>
          )}
        </span>
      </button>
    </SwipeToReveal>
  );
}

/** How an expense moves my balance, in cents: what I lent (I paid) or borrowed (someone else paid). */
function myImpact(expense: SharedExpenseItem, meId: string) {
  const share = expense.shares.find((s) => s.user_id === meId)?.amount ?? 0;
  const paid = expense.paid_by === meId;
  return { involved: paid || share > 0, cents: Math.round(((paid ? expense.total_amount : 0) - share) * 100) };
}

/** "Today" / "Yesterday" / "15 Oct" for a day header. */
function dayLabel(date: string, lang: string, t: ReturnType<typeof useTranslations>) {
  const today = appNow();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date === toDateString(today)) return t("shared.today");
  if (date === toDateString(yesterday)) return t("shared.yesterday");
  const d = parseDateString(date);
  return d.toLocaleDateString(lang, { day: "numeric", month: "short", ...(d.getFullYear() !== today.getFullYear() && { year: "numeric" }) });
}

/** Consecutive items grouped by day, keeping their order. */
function byDay<T>(items: T[], day: (item: T) => string) {
  const days: { day: string; items: T[] }[] = [];
  for (const item of items) {
    const key = day(item);
    if (days.at(-1)?.day === key) days.at(-1)!.items.push(item);
    else days.push({ day: key, items: [item] });
  }
  return days;
}

/** My balance in the group and, for each debt I take part in, a row with "Settle up". */
function GroupBalanceCard({ data, meId, onSettle }: { data: GroupDetailData; meId: string; onSettle: (transfer: Transfer) => void }) {
  const t = useTranslations(useLang());
  const profiles = new Map([...data.members, ...data.extra_profiles].map((m) => [m.user_id, m]));
  const net = data.nets.find((n) => n.user_id === meId)?.net_cents ?? 0;
  const mine = data.transfers.filter((tr) => tr.from === meId || tr.to === meId);
  const archived = !!data.group.archived_at;

  return (
    <div className="lp-card sc-ghero">
      <span className="sc-caption">{t("groups.yourGroupBalance")}</span>
      {net === 0 ? (
        <div className="sc-square">
          <span className="sc-square-icon" aria-hidden>
            <Check className="size-5" />
          </span>
          <strong>{t("groups.allSquare")}</strong>
        </div>
      ) : (
        <>
          <SensitiveAmount className={cn("sc-num sc-balance-value", toneClass(net))}>{signedMoney(net)}</SensitiveAmount>
          <span className={cn("sc-dir", toneClass(net))}>{t(net > 0 ? "shared.isOwedYou" : "shared.owesYou")}</span>
        </>
      )}
      {mine.length > 0 && (
        <div className="sc-mine">
          {mine.map((tr) => {
            const other = profiles.get(tr.from === meId ? tr.to : tr.from);
            const iPay = tr.from === meId;
            return (
              <div key={`${tr.from}-${tr.to}`} className="sc-mine-row">
                {other && <ProfileAvatar name={other.display_name} url={other.avatar_url} size={32} />}
                <span className="lp-main">
                  <span className="lp-title">
                    <span>{other?.display_name ?? "?"}</span>
                  </span>
                  <span className="lp-meta">
                    <span className="lp-truncate">{t(iPay ? "groups.youOweThem" : "groups.owesYou")}</span>
                  </span>
                </span>
                <span className={cn("lp-amount", iPay ? "sc-neg" : "sc-pos")}>{money(fromCents(tr.cents))}</span>
                {!archived && (
                  <button type="button" className={cn("sc-settle-btn", iPay && "sc-settle-btn--primary")} onClick={() => onSettle(tr)}>
                    {t("settle.button")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="sc-gstats">
        <div>
          {t("groups.spentTotal")}
          <b className="sc-num">{money(fromCents(data.total_spent_cents))}</b>
        </div>
      </div>
    </div>
  );
}

/**
 * The rest of who pays whom (mine, with "Settle up", are in the balance card above) and a bar per
 * person growing from zero.
 */
function BalancesPanel({ data, meId }: { data: GroupDetailData; meId: string }) {
  const t = useTranslations(useLang());
  const label = useMemberLabel(meId);
  const profiles = new Map([...data.members, ...data.extra_profiles].map((m) => [m.user_id, m]));
  const name = (id: string) => (profiles.has(id) ? label(profiles.get(id)!) : "?");
  const involved = data.transfers.some((tr) => tr.from === meId || tr.to === meId);
  const others = data.transfers.filter((tr) => tr.from !== meId && tr.to !== meId);
  const nets = [...data.nets].sort((a, b) => b.net_cents - a.net_cents);
  const max = Math.max(1, ...nets.map((n) => Math.abs(n.net_cents)));
  const avatar = (id: string) => {
    const p = profiles.get(id);
    return p ? <ProfileAvatar name={p.display_name} url={p.avatar_url} size={24} /> : null;
  };

  return (
    <div className="lp-sections">
      {(data.transfers.length === 0 || others.length > 0) && (
        <section className="lp-section">
          <div className="lp-section-head">
            <span className="lp-section-title">{t(involved ? "shared.betweenOthers" : "shared.toSettle")}</span>
          </div>
          {data.transfers.length === 0 ? (
            <div className="lp-card lp-empty">
              <div className="sc-square-icon" aria-hidden>
                <Check className="size-5" />
              </div>
              <p className="lp-empty-text">{t("shared.allSettled")}</p>
            </div>
          ) : (
            <div className="lp-card lp-group">
              {others.map((tr) => (
                <div key={`${tr.from}-${tr.to}`} className="lp-row lp-row--static">
                  <span className="sc-pair" aria-hidden>
                    {avatar(tr.from)}
                    <ArrowRight className="size-3.5" />
                    {avatar(tr.to)}
                  </span>
                  <span className="lp-main">
                    <span className="lp-title">
                      <span>{interpolate(t("shared.transferOthers"), { from: name(tr.from), to: name(tr.to) })}</span>
                    </span>
                  </span>
                  <span className="lp-amount">{money(fromCents(tr.cents))}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="lp-section">
        <div className="lp-section-head">
          <span className="lp-section-title">{t("shared.everyoneBalance")}</span>
        </div>
        <div className="sc-legend" aria-hidden>
          <span>
            <i style={{ background: "var(--danger-text)" }} />
            {t("shared.owes")}
          </span>
          <span>
            <i style={{ background: "var(--success-text)" }} />
            {t("shared.isOwed")}
          </span>
        </div>
        <div className="lp-card lp-group">
          {nets.map(({ user_id: id, net_cents: cents }) => (
            <div key={id} className="sc-bal">
              {profiles.get(id) ? <ProfileAvatar name={profiles.get(id)!.display_name} url={profiles.get(id)!.avatar_url} size={32} /> : <span />}
              <span className="sc-bal-name">{name(id)}</span>
              <span className="sc-bal-end">
                <NetAmount cents={cents} />
                {cents !== 0 && <small>{t(cents > 0 ? "shared.isOwed" : "shared.owes")}</small>}
              </span>
              <span className="sc-bar" aria-hidden>
                {cents !== 0 && <span className={cents > 0 ? "sc-bar-pos" : "sc-bar-neg"} style={{ width: `${(Math.abs(cents) / max) * 50}%` }} />}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function eventText(event: SharedEventItem, name: (id: string) => string, t: ReturnType<typeof useTranslations>) {
  const s = event.summary as { title?: string; total?: number; from?: string; to?: string; user_id?: string };
  const actor = name(event.actor_id);
  const amount = s.total != null ? formatCurrency(Number(s.total)) : "";
  switch (event.action) {
    case "created":
      return interpolate(t("shared.event.created"), { actor, title: s.title ?? "", amount });
    case "updated":
      return interpolate(t("shared.event.updated"), { actor, title: s.title ?? "", amount });
    case "deleted":
      return interpolate(t("shared.event.deleted"), { actor, title: s.title && s.title !== "settlement" ? s.title : t("shared.settlement"), amount });
    case "settled":
      return interpolate(t("shared.event.settled"), { actor, from: name(s.from ?? ""), to: name(s.to ?? ""), amount });
    case "member_added":
      return interpolate(t("shared.event.memberAdded"), { actor, name: name(s.user_id ?? "") });
    default:
      return interpolate(t("shared.event.memberRemoved"), { actor, name: name(s.user_id ?? "") });
  }
}

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  created: Plus,
  updated: Pencil,
  deleted: Trash2,
  settled: ArrowLeftRight,
  member_added: UserPlus,
};

function ActivityTab({ data, meId }: { data: GroupDetailData; meId: string }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const label = useMemberLabel(meId);
  const profiles = new Map([...data.members, ...data.extra_profiles].map((m) => [m.user_id, m]));
  const name = (id: string) => (profiles.has(id) ? label(profiles.get(id)!) : "?");

  if (data.events.length === 0) {
    return (
      <div className="lp-card lp-empty">
        <p className="lp-empty-text">{t("shared.noActivity")}</p>
      </div>
    );
  }
  const days = byDay(data.events, (event) => toDateString(toAppDate(event.created_at)));
  return (
    <div className="lp-sections">
      {days.map(({ day, items }) => (
        <section key={day} className="lp-section">
          <h3 className="sc-day">{dayLabel(day, lang, t)}</h3>
          <div className="lp-card lp-group">
            {items.map((event) => {
              const Icon = EVENT_ICONS[event.action] ?? UserMinus;
              return (
                <div key={event.id} className="lp-row lp-row--static sc-ev">
                  <span className={`sc-ev-icon sc-ev-icon--${event.action}`} aria-hidden>
                    <Icon className="size-4" />
                  </span>
                  <span className="lp-main">
                    <span className="lp-title">
                      <span>{eventText(event, name, t)}</span>
                    </span>
                    <span className="lp-meta">
                      <span className="lp-truncate">{toAppDate(event.created_at).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}</span>
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** One group: expenses, who pays whom (with "Settle up") and activity. */
export default function GroupDetail({ id }: { id: string }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const isDesktop = useMediaQuery("(min-width: 1200px)");
  const { data: profile } = useProfile();
  const [limit, setLimit] = useState(PAGE);
  const { data, isLoading, isError, isPlaceholderData } = useGroup(id, limit);
  const [tab, setTab] = useState<Tab>("expenses");
  const [editing, setEditing] = useState<SharedExpenseItem | null>(null);
  // Deep link (a notification): /subcount/{group}?expense={id} shows the group with that expense picked out
  // (not its edit form), also while the page is already open.
  const [expenseParam, clearExpenseParam] = useUrlParam("expense", parseIdParam);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const linkedExpense = expenseParam ? data?.expenses.find((expense) => expense.id === expenseParam) : undefined;
  const linkSettled = !!expenseParam && !!data && !isPlaceholderData && !linkedExpense;
  const linkGone = linkSettled && !data.has_more;
  // An older expense, not in the page loaded so far: load more until it shows up.
  if (linkSettled && data.has_more) setLimit(limit + PAGE);
  if (linkedExpense && highlighted !== linkedExpense.id) {
    setHighlighted(linkedExpense.id);
    setTab("expenses");
  }
  useEffect(() => {
    if (linkGone || linkedExpense) clearExpenseParam(); // picked out, or deleted since (then just the group)
  }, [linkGone, linkedExpense, clearExpenseParam]);
  useEffect(() => {
    if (!highlighted) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelector(`[data-swipe-id="${highlighted}"]`)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    const timer = setTimeout(() => setHighlighted(null), 2400);
    return () => clearTimeout(timer);
  }, [highlighted]);
  const [toDelete, setToDelete] = useState<SharedExpenseItem | null>(null);
  const deleteExpense = useUndoableDeleteSharedExpense();
  const removeSettlement = useDeleteSharedExpense();
  const [creating, setCreating] = useState(false);
  const [settle, setSettle] = useState<Transfer | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const back = (
    <Link href="/subcount" className="sc-back">
      <ChevronLeft className="size-4" aria-hidden />
      {t("groups.title")}
    </Link>
  );

  if (isLoading || !profile) {
    return (
      <div className="page-container lp-page fade-in">
        {back}
        <div className="flex items-center justify-center min-h-[12rem]">
          <Spinner className="size-8 text-muted-foreground" />
        </div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="page-container lp-page fade-in">
        {back}
        <p className="lp-note">{t("groups.notFound")}</p>
      </div>
    );
  }

  const meId = profile.user_id;
  const profiles = new Map([...data.members, ...data.extra_profiles].map((m) => [m.user_id, m]));
  const archived = !!data.group.archived_at;
  // Desktop keeps the balances in the side column, so its tabs are only Expenses | Activity.
  const shownTab: Tab = isDesktop && tab === "balances" ? "expenses" : tab;
  const memberNames = [...data.members].sort((a, b) => Number(b.user_id === meId) - Number(a.user_id === meId)).map((m) => (m.user_id === meId ? t("split.you") : m.display_name));
  const listFormat = new Intl.ListFormat(lang, { type: "conjunction" });
  const membersText =
    memberNames.length > 4
      ? interpolate(t("groups.andMore"), { names: memberNames.slice(0, 3).join(", "), n: String(memberNames.length - 3) })
      : listFormat.format(memberNames);

  const expenses =
    data.expenses.length === 0 ? (
      <div className="lp-card lp-empty">
        <div className="lp-empty-icon">
          <Receipt />
        </div>
        <p className="lp-empty-text">{t("shared.empty")}</p>
        {!archived && (
          <button type="button" className="lp-chip" onClick={() => setCreating(true)}>
            {t("shared.add")}
          </button>
        )}
      </div>
    ) : (
      <>
        <SwipeToRevealGroup className="lp-sections">
          {byDay(data.expenses, (expense) => expense.date.slice(0, 10)).map(({ day, items }) => (
            <section key={day} className="lp-section">
              <h3 className="sc-day">{dayLabel(day, lang, t)}</h3>
              <div className="lp-card lp-group">
                {items.map((expense) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    meId={meId}
                    profiles={profiles}
                    highlighted={expense.id === highlighted}
                    onOpen={setEditing}
                    onDelete={(item) => (item.kind === "settlement" ? setToDelete(item) : deleteExpense(item))}
                  />
                ))}
              </div>
            </section>
          ))}
        </SwipeToRevealGroup>
        {data.has_more && (
          <SheetButton type="button" variant="ghost" onClick={() => setLimit(limit + PAGE)}>
            {t("shared.loadMore")}
          </SheetButton>
        )}
      </>
    );

  return (
    <div className="page-container lp-page fade-in">
      {back}
      <header className="sc-head">
        <h1>{data.group.name}</h1>
        <div className="sc-head-actions">
          <HeaderBell />
          <button type="button" className="sc-icon-btn" aria-label={t("groups.settings")} title={t("groups.settings")} onClick={() => setSettingsOpen(true)}>
            <Settings2 className="size-5" />
          </button>
          {!archived && (
            <button type="button" className="add-btn lp-add" onClick={() => setCreating(true)} aria-label={t("shared.add")}>
              <Plus className="size-5" strokeWidth={2.5} aria-hidden />
              <span className="lp-add-label">{t("shared.add")}</span>
            </button>
          )}
        </div>
      </header>
      <div className="sc-members">
        <AvatarStack people={data.members} max={4} size={22} />
        <span>{membersText}</span>
      </div>

      <div className="sc-group">
        <div className="sc-group-main">
          {!isDesktop && <GroupBalanceCard data={data} meId={meId} onSettle={setSettle} />}
          <Segmented
            label={t("groups.title")}
            value={shownTab}
            onChange={setTab}
            options={[
              { value: "expenses", label: t("shared.tab.expenses") },
              ...(isDesktop ? [] : [{ value: "balances" as const, label: t("shared.tab.balances") }]),
              { value: "activity", label: t("shared.tab.activity") },
            ]}
          />
          {shownTab === "expenses" && expenses}
          {shownTab === "balances" && <BalancesPanel data={data} meId={meId} />}
          {shownTab === "activity" && <ActivityTab data={data} meId={meId} />}
        </div>
        {isDesktop && (
          <aside className="sc-group-aside">
            <GroupBalanceCard data={data} meId={meId} onSettle={setSettle} />
            <BalancesPanel data={data} meId={meId} />
          </aside>
        )}
      </div>

      <SharedExpenseSheet
        open={creating || (!!editing && editing.kind === "expense")}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        groupId={data.group.id}
        members={data.members}
        meId={meId}
        expense={editing}
      />
      <SettlementDeleteSheet
        expense={editing?.kind === "settlement" ? editing : null}
        profiles={profiles}
        meId={meId}
        onClose={() => setEditing(null)}
      />
      <ConfirmDeleteSheet
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t(toDelete?.kind === "settlement" ? "shared.settlementUndoTitle" : "shared.deleteTitle")}
        description={t(toDelete?.kind === "settlement" ? "shared.settlementUndoHint" : "shared.deleteConfirm")}
        confirmLabel={toDelete?.kind === "settlement" ? t("shared.settlementUndo") : undefined}
        icon={toDelete?.kind === "settlement" ? <HandCoins /> : undefined}
        pending={removeSettlement.isPending}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await removeSettlement.mutateAsync(toDelete.id);
          } catch {
            return; // the error toast is already up; keep the confirmation to retry
          }
          setToDelete(null);
        }}
      />
      <SettleUpSheet
        open={!!settle}
        onOpenChange={(open) => !open && setSettle(null)}
        groupId={data.group.id}
        members={[...data.members, ...data.extra_profiles]}
        meId={meId}
        transfer={settle}
      />
      <GroupSettingsSheet key={data.group.name} open={settingsOpen} onOpenChange={setSettingsOpen} data={data} meId={meId} />
    </div>
  );
}

/** Details of a settlement with the option to undo it (delete). */
function SettlementDeleteSheet({ expense, profiles, meId, onClose }: {
  expense: SharedExpenseItem | null;
  profiles: Map<string, SharedProfile>;
  meId: string;
  onClose: () => void;
}) {
  const t = useTranslations(useLang());
  const label = useMemberLabel(meId);
  const [shown, setShown] = useState(expense);
  if (expense && expense !== shown) setShown(expense);
  const e = expense ?? shown;
  const from = e && profiles.get(e.paid_by);
  const to = e && profiles.get(e.shares[0]?.user_id ?? "");
  return (
    <Sheet open={!!expense} onOpenChange={(open) => !open && onClose()} title={t("shared.settlement")}>
      <SheetBody>
        {e && from && to && (
          <FieldGroup hint={t("shared.settlementUndoHint")}>
            <FieldRow label={t("settle.title")}>
              <span>
                {label(from)} → {label(to)} · {money(e.total_amount)}
              </span>
            </FieldRow>
            <DeleteSettlement expense={e} onDone={onClose} />
          </FieldGroup>
        )}
      </SheetBody>
    </Sheet>
  );
}

function DeleteSettlement({ expense, onDone }: { expense: SharedExpenseItem; onDone: () => void }) {
  const t = useTranslations(useLang());
  const remove = useDeleteSharedExpense();
  return (
    <DeleteAction
      label={t("shared.settlementUndo")}
      confirmTitle={t("shared.settlementUndoTitle")}
      confirmText={t("shared.settlementUndoHint")}
      pending={remove.isPending}
      onConfirm={async () => {
        try {
          await remove.mutateAsync(expense.id);
        } catch {
          return; // the error toast is already up; keep the confirmation to retry
        }
        onDone();
      }}
    />
  );
}
