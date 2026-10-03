"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, HandCoins, Plus, Settings2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { NetAmount } from "@/components/GroupsBody";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { SettleUpSheet } from "@/components/SettleUpSheet";
import { Chips, DeleteAction, FieldGroup, FieldRow, FieldStack, FormError, RowInput, Segmented, SheetButton } from "@/components/SheetFields";
import { SharedExpenseSheet } from "@/components/SharedExpenseSheet";
import { useMemberLabel } from "@/components/SplitEditor";
import { Sheet, SheetBody, SheetFooter, SheetForm } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useFriends } from "@/hooks/useFriends";
import { useAddGroupMember, useDeleteGroup, useGroup, useRemoveGroupMember, useUpdateGroup } from "@/hooks/useGroups";
import { useLang } from "@/hooks/useLang";
import { useDeleteSharedExpense } from "@/hooks/useSharedExpenses";
import { useProfile } from "@/hooks/useProfile";
import { parseDateString } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import type { Transfer } from "@/lib/shared/debts";
import { sharedErrorText } from "@/lib/shared/errorText";
import { fromCents } from "@/lib/shared/splits";
import type { GroupDetailData, SharedEventItem, SharedExpenseItem, SharedProfile } from "@/lib/shared/types";

type Tab = "expenses" | "balances" | "activity";
const PAGE = 30;

const money = (n: number) => <SensitiveAmount>{formatCurrency(n)}</SensitiveAmount>;

function GroupSettingsSheet({ open, onOpenChange, data, meId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: GroupDetailData;
  meId: string;
}) {
  const t = useTranslations(useLang());
  const label = useMemberLabel(meId);
  const { data: friends } = useFriends(open);
  const update = useUpdateGroup();
  const add = useAddGroupMember();
  const remove = useRemoveGroupMember();
  const deleteGroup = useDeleteGroup();
  const router = useRouter();
  const [name, setName] = useState(data.group.name);
  const [error, setError] = useState("");
  const archived = !!data.group.archived_at;
  const memberIds = new Set(data.members.map((m) => m.user_id));
  const addable = (friends?.friends ?? []).filter((f) => !memberIds.has(f.profile.user_id));
  const fail = (err: Error) => toast.error(sharedErrorText(t, err.message));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError(t("groups.error.invalid_name"));
    try {
      await update.mutateAsync({ id: data.group.id, name: name.trim() });
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
                        { onError: fail, onSuccess: () => m.user_id === meId && onOpenChange(false) }
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
                  onChange={(userId) => add.mutate({ groupId: data.group.id, userId }, { onError: fail })}
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
              <SheetButton type="button" variant="ghost" onClick={() => update.mutate({ id: data.group.id, archived: false }, { onError: fail })}>
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
                  await update.mutateAsync({ id: data.group.id, archived: true }).catch(fail);
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
                  onOpenChange(false);
                  router.replace("/subcount");
                } catch (err) {
                  fail(err as Error);
                }
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

function ExpenseRow({ expense, meId, profiles, onOpen }: {
  expense: SharedExpenseItem;
  meId: string;
  profiles: Map<string, SharedProfile>;
  onOpen: (expense: SharedExpenseItem) => void;
}) {
  const lang = useLang();
  const t = useTranslations(lang);
  const payer = profiles.get(expense.paid_by);
  const payerName = expense.paid_by === meId ? t("split.you") : (payer?.display_name ?? "?");
  const myShare = expense.shares.find((s) => s.user_id === meId)?.amount ?? 0;
  const settlement = expense.kind === "settlement";
  const receiver = settlement ? profiles.get(expense.shares[0]?.user_id ?? "") : undefined;
  const date = parseDateString(expense.date).toLocaleDateString(lang, { day: "numeric", month: "short" });

  return (
    <button type="button" className="lp-row" onClick={() => onOpen(expense)}>
      <span className={`lp-icon ${settlement ? "lp-icon--income" : ""}`} aria-hidden>
        {settlement ? <HandCoins size={18} /> : "🧾"}
      </span>
      <span className="lp-main">
        <span className="lp-title">
          <span>{settlement ? `${payerName} → ${receiver?.display_name ?? "?"}` : expense.title}</span>
          {settlement && <span className="lp-badge">{t("shared.settlement")}</span>}
        </span>
        <span className="lp-meta">
          <span className="lp-truncate">
            {settlement ? date : `${interpolate(t("shared.paidByName"), { name: payerName })} · ${date}`}
          </span>
        </span>
      </span>
      <span className="lp-end">
        <span className="lp-amount">{money(expense.total_amount)}</span>
        {!settlement && myShare > 0 && (
          <span className="lp-sub-amount">
            {t("shared.yourShareLabel")} {money(myShare)}
          </span>
        )}
      </span>
    </button>
  );
}

function BalancesTab({ data, meId, onSettle }: { data: GroupDetailData; meId: string; onSettle: (transfer: Transfer) => void }) {
  const t = useTranslations(useLang());
  const label = useMemberLabel(meId);
  const profiles = new Map([...data.members, ...data.extra_profiles].map((m) => [m.user_id, m]));
  const nets = new Map(data.nets.map((n) => [n.user_id, n.net_cents]));
  const name = (id: string) => (profiles.has(id) ? label(profiles.get(id)!) : "?");

  return (
    <div className="lp-sections">
      <section className="lp-section">
        <div className="lp-section-head">
          <span className="lp-section-title">{t("shared.whoPaysWhom")}</span>
        </div>
        {data.transfers.length === 0 ? (
          <div className="lp-card lp-empty">
            <p className="lp-empty-text">{t("shared.allSettled")}</p>
          </div>
        ) : (
          <div className="lp-card lp-group">
            {data.transfers.map((tr) => (
              <div key={`${tr.from}-${tr.to}`} className="lp-row lp-row--static">
                <span className="lp-main">
                  <span className="lp-title group-transfer">
                    <span>{name(tr.from)}</span>
                    <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                    <span>{name(tr.to)}</span>
                  </span>
                </span>
                <span className="lp-amount">{money(fromCents(tr.cents))}</span>
                {(tr.from === meId || tr.to === meId) && !data.group.archived_at && (
                  <button type="button" className="lp-chip group-settle-btn" onClick={() => onSettle(tr)}>
                    {t("settle.button")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="lp-section">
        <div className="lp-section-head">
          <span className="lp-section-title">{t("shared.balances")}</span>
        </div>
        <div className="lp-card lp-group">
          {[...nets].map(([id, cents]) => (
            <div key={id} className="lp-row lp-row--static">
              {profiles.get(id) && <ProfileAvatar name={profiles.get(id)!.display_name} url={profiles.get(id)!.avatar_url} size={32} />}
              <span className="lp-main">
                <span className="lp-title">
                  <span>{name(id)}</span>
                </span>
              </span>
              <NetAmount cents={cents} />
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
  return (
    <div className="lp-card lp-group">
      {data.events.map((event) => (
        <div key={event.id} className="lp-row lp-row--static">
          <span className="lp-main">
            <span className="lp-title">
              <span>{eventText(event, name, t)}</span>
            </span>
            <span className="lp-meta">
              <span className="lp-truncate">{new Date(event.created_at).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" })}</span>
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** One group: expenses, who pays whom (with "Settle up") and activity. */
export default function GroupDetail({ id }: { id: string }) {
  const t = useTranslations(useLang());
  const { data: profile } = useProfile();
  const [limit, setLimit] = useState(PAGE);
  const { data, isLoading, isError } = useGroup(id, limit);
  const [tab, setTab] = useState<Tab>("expenses");
  const [editing, setEditing] = useState<SharedExpenseItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [settle, setSettle] = useState<Transfer | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const back = (
    <Link href="/subcount" className="group-back">
      <ChevronLeft className="size-4" aria-hidden />
      {t("groups.title")}
    </Link>
  );

  if (isLoading || !profile) {
    return (
      <div className="page-container fade-in">
        {back}
        <div className="flex items-center justify-center min-h-[12rem]">
          <Spinner className="size-8 text-muted-foreground" />
        </div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="page-container fade-in">
        {back}
        <p className="lp-note">{t("groups.notFound")}</p>
      </div>
    );
  }

  const meId = profile.user_id;
  const profiles = new Map([...data.members, ...data.extra_profiles].map((m) => [m.user_id, m]));
  const archived = !!data.group.archived_at;

  return (
    <div className="page-container lp-page fade-in">
      {back}
      <header className="lp-header group-header">
        <div className="group-header-text">
          <h1>{data.group.name}</h1>
          <div className="group-header-meta">
            <span className="group-avatars" aria-hidden>
              {data.members.slice(0, 5).map((m) => (
                <ProfileAvatar key={m.user_id} name={m.display_name} url={m.avatar_url} size={22} />
              ))}
            </span>
            <span className="lp-amount">{money(fromCents(data.total_spent_cents))}</span>
            <span className="lp-sub-amount">{t("groups.totalSpent")}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="lp-icon-btn" aria-label={t("groups.settings")} title={t("groups.settings")} onClick={() => setSettingsOpen(true)}>
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

      <div className="mx-auto w-full max-w-xl flex flex-col gap-4">
        <Segmented
          label={t("groups.title")}
          value={tab}
          onChange={setTab}
          options={[
            { value: "expenses", label: t("shared.tab.expenses") },
            { value: "balances", label: t("shared.tab.balances") },
            { value: "activity", label: t("shared.tab.activity") },
          ]}
        />

        {tab === "expenses" &&
          (data.expenses.length === 0 ? (
            <div className="lp-card lp-empty">
              <p className="lp-empty-text">{t("shared.empty")}</p>
              {!archived && (
                <button type="button" className="lp-chip" onClick={() => setCreating(true)}>
                  {t("shared.add")}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="lp-card lp-group">
                {data.expenses.map((expense) => (
                  <ExpenseRow key={expense.id} expense={expense} meId={meId} profiles={profiles} onOpen={setEditing} />
                ))}
              </div>
              {data.has_more && (
                <SheetButton type="button" variant="ghost" onClick={() => setLimit(limit + PAGE)}>
                  {t("shared.loadMore")}
                </SheetButton>
              )}
            </>
          ))}
        {tab === "balances" && <BalancesTab data={data} meId={meId} onSettle={setSettle} />}
        {tab === "activity" && <ActivityTab data={data} meId={meId} />}
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
        await remove.mutateAsync(expense.id).catch((err: Error) => toast.error(sharedErrorText(t, err.message)));
        onDone();
      }}
    />
  );
}
