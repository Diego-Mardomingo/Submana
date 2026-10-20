"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronRight, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "@/lib/toast";
import { ConfirmDeleteSheet } from "@/components/ConfirmSheet";
import { GroupSettingsSheet, PAGE } from "@/components/GroupDetail";
import { HandleSetup } from "@/components/HandleSetup";
import { CompactPageHeader } from "@/components/PageHeader";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { Chips, FieldGroup, FieldRow, FieldStack, FormError, RowInput, SheetButton } from "@/components/SheetFields";
import { SwipeToReveal, SwipeToRevealGroup } from "@/components/SwipeToReveal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetBody, SheetFooter, SheetForm, useSheetPayload } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useFriends } from "@/hooks/useFriends";
import { useCreateGroup, useDeleteGroup, useGroup, useGroups, useSharedBalances } from "@/hooks/useGroups";
import { useLang } from "@/hooks/useLang";
import { useProfile } from "@/hooks/useProfile";
import { formatCurrency } from "@/lib/format";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { sharedErrorText } from "@/lib/shared/errorText";
import { fromCents } from "@/lib/shared/splits";
import type { BalancesData, FriendBalance, GroupSummary, SharedProfile } from "@/lib/shared/types";
import { cn } from "@/lib/utils";

const SectionHead = ({ title, count }: { title: string; count?: number }) => (
  <div className="lp-section-head">
    <span className="lp-section-title">
      {title}
      {count ? <small>{count}</small> : null}
    </span>
  </div>
);

/** "+12,00 €" / "−12,00 €" (a real minus sign) / "0,00 €". */
export const signedMoney = (cents: number) =>
  cents === 0 ? formatCurrency(0) : `${cents > 0 ? "+" : "−"}${formatCurrency(Math.abs(fromCents(cents)))}`;

/** Green when it is in my favour, red when against me. */
export const toneClass = (cents: number) => (cents > 0 ? "sc-pos" : cents < 0 ? "sc-neg" : "is-muted");

/** Signed amount with the in favour / against colouring. */
export function NetAmount({ cents, className }: { cents: number; className?: string }) {
  return (
    <span className={cn("lp-amount", toneClass(cents), className)}>
      <SensitiveAmount>{signedMoney(cents)}</SensitiveAmount>
    </span>
  );
}

/** Up to `max` avatars, then a "+N" bubble. */
export function AvatarStack({ people, max = 3, size = 28 }: { people: SharedProfile[]; max?: number; size?: number }) {
  const extra = people.length - max;
  const shown = people.slice(0, extra > 0 ? max - 1 : max);
  return (
    <span className="sc-avatars" aria-hidden>
      {shown.map((m) => (
        <ProfileAvatar key={m.user_id} name={m.display_name} url={m.avatar_url} size={size} />
      ))}
      {extra > 0 && (
        <span className="sc-avatar-more" style={{ width: size, height: size }}>
          +{extra + 1}
        </span>
      )}
    </span>
  );
}

/** Overview card: my net across groups, a bar comparing both sides and each side with how many people. */
function BalanceCard({ balances }: { balances: BalancesData }) {
  const t = useTranslations(useLang());
  const net = balances.owed_to_me_cents - balances.i_owe_cents;
  const owing = balances.friends.filter((f) => f.cents > 0).length;
  const owed = balances.friends.filter((f) => f.cents < 0).length;
  const people = (n: number) => (n === 1 ? t("groups.onePerson") : interpolate(t("groups.nPeople"), { n: String(n) }));

  if (balances.owed_to_me_cents === 0 && balances.i_owe_cents === 0) {
    return (
      <div className="lp-card sc-balance sc-area-balance">
        <div>
          <span className="sc-caption">{t("groups.yourBalance")}</span>
          <div className="sc-square">
            <span className="sc-square-icon" aria-hidden>
              <Check className="size-5" />
            </span>
            <div>
              <strong>{t("groups.allSquare")}</strong>
              <span className="sc-caption">{t("groups.allSquareHint")}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lp-card sc-balance sc-balance--split sc-area-balance">
      <div className="sc-balance-main">
        <span className="sc-caption">{t("groups.yourBalance")}</span>
        <SensitiveAmount className={cn("sc-num sc-balance-value", toneClass(net))}>{signedMoney(net)}</SensitiveAmount>
        <span className={cn("sc-dir", toneClass(net))}>
          {net >= 0 ? t("groups.inYourFavor") : t("groups.againstYou")}
        </span>
        <div className="sc-ratio" aria-hidden>
          {balances.owed_to_me_cents > 0 && <span className="sc-ratio-pos" style={{ flexGrow: balances.owed_to_me_cents }} />}
          {balances.i_owe_cents > 0 && <span className="sc-ratio-neg" style={{ flexGrow: balances.i_owe_cents }} />}
        </div>
      </div>
      <div className="sc-halves">
        <div className={cn("sc-half", balances.owed_to_me_cents > 0 && "sc-half--pos")}>
          <span className="sc-caption">{t("groups.friendsOweYou")}</span>
          <SensitiveAmount className={cn("sc-num sc-half-value", balances.owed_to_me_cents > 0 ? "sc-pos" : "is-muted")}>
            {formatCurrency(fromCents(balances.owed_to_me_cents))}
          </SensitiveAmount>
          {owing > 0 && <small>{people(owing)}</small>}
        </div>
        <div className={cn("sc-half", balances.i_owe_cents > 0 && "sc-half--neg")}>
          <span className="sc-caption">{t("groups.youOweTotal")}</span>
          <SensitiveAmount className={cn("sc-num sc-half-value", balances.i_owe_cents > 0 ? "sc-neg" : "is-muted")}>
            {formatCurrency(fromCents(balances.i_owe_cents))}
          </SensitiveAmount>
          {owed > 0 && <small>{people(owed)}</small>}
        </div>
      </div>
    </div>
  );
}

const PEOPLE_SHOWN = 5;

/** Who owes me and whom I owe, adding up every group; tapping one opens the breakdown by group. */
function PeopleSection({ friends, groups }: { friends: FriendBalance[]; groups: GroupSummary[] }) {
  const t = useTranslations(useLang());
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const people = friends.filter((f) => f.cents !== 0).sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents));
  const groupName = new Map(groups.map((g) => [g.id, g]));
  const shownPerson = useSheetPayload(!!openId, people.find((f) => f.profile.user_id === openId) ?? null);
  if (people.length === 0) return null;
  const visible = showAll ? people : people.slice(0, PEOPLE_SHOWN);
  const where = (f: FriendBalance) => {
    const inGroups = f.groups.filter((g) => g.cents !== 0);
    return inGroups.length === 1 ? (groupName.get(inGroups[0].group_id)?.name ?? "") : interpolate(t("groups.inNGroups"), { n: String(inGroups.length) });
  };

  return (
    <section className="lp-section sc-area-people">
      <SectionHead title={t("groups.people")} />
      <div className="lp-card lp-group">
        {visible.map((f) => (
          <button key={f.profile.user_id} type="button" className="lp-row" onClick={() => setOpenId(f.profile.user_id)}>
            <ProfileAvatar name={f.profile.display_name} url={f.profile.avatar_url} size={36} />
            <span className="lp-main">
              <span className="lp-title">
                <span>{f.profile.display_name}</span>
              </span>
              <span className="lp-meta">
                <span className="lp-truncate">{where(f)}</span>
              </span>
            </span>
            <span className="lp-end">
              <NetAmount cents={f.cents} />
              <span className={cn("sc-dir", toneClass(f.cents))}>{t(f.cents > 0 ? "groups.owesYou" : "groups.youOweThem")}</span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </button>
        ))}
      </div>
      {people.length > PEOPLE_SHOWN && (
        <button type="button" className="sc-show-all" onClick={() => setShowAll(!showAll)}>
          {showAll ? t("groups.showLess") : `${t("groups.showAll")} (${people.length})`}
        </button>
      )}

      <Sheet open={!!openId} onOpenChange={(open) => !open && setOpenId(null)} title={shownPerson?.profile.display_name ?? ""}>
        {shownPerson && (
          <SheetBody>
            <div className="sc-person">
              <ProfileAvatar name={shownPerson.profile.display_name} url={shownPerson.profile.avatar_url} size={56} />
              <SensitiveAmount className={cn("sc-num sc-balance-value", toneClass(shownPerson.cents))}>{signedMoney(shownPerson.cents)}</SensitiveAmount>
              <span className={cn("sc-dir", toneClass(shownPerson.cents))}>
                {t(shownPerson.cents > 0 ? "groups.owesYouTotal" : "groups.youOweThemTotal")}
              </span>
            </div>
            <FieldGroup title={t("groups.byGroup")} hint={t("groups.personHint")}>
              <div className="lp-group">
                {shownPerson.groups
                  .filter((g) => g.cents !== 0)
                  .sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents))
                  .map((g) => {
                    const group = groupName.get(g.group_id);
                    return (
                      <Link key={g.group_id} href={`/subcount/${g.group_id}`} className="lp-row">
                        <span className="lp-main">
                          <span className="lp-title">
                            <span>{group?.name ?? "?"}</span>
                          </span>
                          {group && (
                            <span className="lp-meta">
                              <span className="lp-truncate">{`${group.members.length} ${t("groups.membersCount")}`}</span>
                            </span>
                          )}
                        </span>
                        <NetAmount cents={g.cents} />
                        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                      </Link>
                    );
                  })}
              </div>
            </FieldGroup>
          </SheetBody>
        )}
      </Sheet>
    </section>
  );
}

function OverviewSkeleton() {
  return (
    <div className="sc-overview" aria-hidden>
      <div className="lp-card sc-balance sc-area-balance">
        <div>
          <span className="skeleton block h-3 w-20" />
          <span className="skeleton mt-3 block h-9 w-44" />
          <span className="skeleton mt-4 block h-2 w-full rounded-full" />
        </div>
        <div className="sc-halves">
          <span className="skeleton block h-16 rounded-[14px]" />
          <span className="skeleton block h-16 rounded-[14px]" />
        </div>
      </div>
      <div className="lp-card lp-group sc-area-groups">
        {[0, 1, 2].map((i) => (
          <div key={i} className="sc-skeleton-row">
            <span className="skeleton block size-9 rounded-full" />
            <span className="flex flex-1 flex-col gap-1.5">
              <span className="skeleton block h-3 w-1/2" />
              <span className="skeleton block h-2.5 w-1/3" />
            </span>
            <span className="skeleton block h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateGroupSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations(useLang());
  const router = useRouter();
  const { data: friends } = useFriends();
  const create = useCreateGroup();
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError(t("groups.error.invalid_name"));
      return;
    }
    try {
      const group = await create.mutateAsync({ name: name.trim(), member_ids: memberIds });
      toast.success(t("groups.created"));
      onOpenChange(false);
      setName("");
      setMemberIds([]);
      router.push(`/subcount/${group.id}`);
    } catch (err) {
      setError(sharedErrorText(t, err instanceof Error ? err.message : undefined));
    }
  };

  const options = (friends?.friends ?? []).map((f) => ({
    value: f.profile.user_id,
    label: f.profile.display_name,
    icon: <ProfileAvatar name={f.profile.display_name} url={f.profile.avatar_url} size={18} />,
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("groups.create")}>
      <SheetForm onSubmit={submit}>
        <SheetBody>
          <FieldGroup>
            <FieldRow label={t("groups.name")} htmlFor="group-name">
              <RowInput id="group-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t("groups.namePlaceholder")} />
            </FieldRow>
          </FieldGroup>
          <FieldGroup title={t("groups.members")} hint={options.length === 0 ? t("groups.noFriends") : t("groups.membersHint")}>
            {options.length > 0 && (
              <FieldStack>
                <Chips multiple label={t("groups.members")} value={memberIds} onChange={setMemberIds} options={options} />
              </FieldStack>
            )}
          </FieldGroup>
        </SheetBody>
        <SheetFooter>
          <FormError>{error}</FormError>
          <SheetButton type="submit" pending={create.isPending}>
            {t("groups.create")}
          </SheetButton>
        </SheetFooter>
      </SheetForm>
    </Sheet>
  );
}

function GroupRow({ group, onEdit, onDelete }: { group: GroupSummary; onEdit: (id: string) => void; onDelete: (group: GroupSummary) => void }) {
  const t = useTranslations(useLang());
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };
  return (
    <SwipeToReveal
      id={group.id}
      className="lp-swipe"
      desktopMinWidth={1024}
      actions={
        <>
          <button type="button" onClick={stop(() => onEdit(group.id))} className="lp-action lp-action--edit" aria-label={t("groups.settings")}>
            <Pencil className="size-5" />
          </button>
          <button type="button" onClick={stop(() => onDelete(group))} className="lp-action lp-action--danger" aria-label={t("groups.delete")}>
            <Trash2 className="size-5" />
          </button>
        </>
      }
    >
      <Link href={`/subcount/${group.id}`} className="lp-row">
        <AvatarStack people={group.members} />
        <span className="lp-main">
          <span className="lp-title">
            <span>{group.name}</span>
          </span>
          <span className="lp-meta">
            <span className="lp-truncate">{`${group.members.length} ${t("groups.membersCount")}`}</span>
          </span>
        </span>
        <span className="lp-end">
          {group.my_net_cents === 0 ? (
            <span className="sc-settled">
              <Check className="size-3.5" aria-hidden />
              {t("groups.upToDate")}
            </span>
          ) : (
            <>
              <NetAmount cents={group.my_net_cents} />
              <span className={cn("sc-dir", toneClass(group.my_net_cents))}>{t(group.my_net_cents > 0 ? "groups.owedToYou" : "groups.youOwe")}</span>
            </>
          )}
        </span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
    </SwipeToReveal>
  );
}

/** Subcount: what friends owe me overall, my groups and, folded away, the archived ones. Asks for a @handle first when there is no profile. */
export default function GroupsBody() {
  const t = useTranslations(useLang());
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: groups = [], isLoading: groupsLoading } = useGroups(!!profile);
  const { data: balances } = useSharedBalances(!!profile);
  const { data: friends } = useFriends(!!profile);
  const [createOpen, setCreateOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  // The last edited / deleted group stays set while its sheet closes so the content doesn't vanish mid-animation.
  const [editId, setEditId] = useState<string>();
  const [editOpen, setEditOpen] = useState(false);
  const [toDelete, setToDelete] = useState<GroupSummary | null>(null);
  const [deleteId, setDeleteId] = useState<string>();
  // Same query as the group page: the settings sheet needs its members and the delete text whether debts remain.
  const { data: editData } = useGroup(editId, PAGE);
  const { data: deleteData } = useGroup(deleteId, PAGE);
  const deleteGroup = useDeleteGroup();

  const header = <CompactPageHeader title={t("groups.title")} addLabel={profile ? t("groups.create") : undefined} onAdd={() => setCreateOpen(true)} />;

  if (profileLoading) {
    return (
      <div className="page-container fade-in">
        {header}
        <div className="flex items-center justify-center min-h-[12rem]">
          <Spinner className="size-8 text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page-container fade-in">
        {header}
        <div className="mx-auto w-full max-w-md">
          <HandleSetup />
        </div>
      </div>
    );
  }

  const active = groups.filter((g) => !g.archived_at);
  const archived = groups.filter((g) => g.archived_at);
  const noFriends = friends && friends.friends.length === 0;
  const edit = (id: string) => {
    setEditId(id);
    setEditOpen(true);
  };
  const askDelete = (group: GroupSummary) => {
    setDeleteId(group.id);
    setToDelete(group);
  };

  return (
    <div className="page-container lp-page fade-in">
      {header}
      {groupsLoading || !balances ? (
        <OverviewSkeleton />
      ) : (
        <div className="sc-overview">
          {groups.length > 0 && <BalanceCard balances={balances} />}
          <PeopleSection friends={balances.friends} groups={groups} />
          <div className="lp-sections sc-area-groups">
            <section className="lp-section">
              <SectionHead title={t("groups.list")} count={active.length} />
              {active.length === 0 ? (
                <div className="lp-card lp-empty">
                  <div className="lp-empty-icon">
                    <Users />
                  </div>
                  <p className="lp-empty-title">{t("groups.emptyTitle")}</p>
                  <p className="lp-empty-text">{t("groups.empty")}</p>
                  <button type="button" className="lp-chip" onClick={() => setCreateOpen(true)}>
                    {t("groups.create")}
                  </button>
                </div>
              ) : (
                <SwipeToRevealGroup className="lp-card lp-group">
                  {active.map((g) => (
                    <GroupRow key={g.id} group={g} onEdit={edit} onDelete={askDelete} />
                  ))}
                </SwipeToRevealGroup>
              )}
              {noFriends && (
                <p className="lp-note">
                  {t("groups.noFriends")} <Link href="/friends" className="underline">{t("nav.friends")}</Link>
                </p>
              )}
            </section>

            {archived.length > 0 && (
              <Collapsible open={archivedOpen} onOpenChange={setArchivedOpen} className="lp-section">
                <CollapsibleTrigger className="lp-collapse-trigger">
                  <span>
                    {t("groups.archived")} · {archived.length}
                  </span>
                  <ChevronDown className="size-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="subs-collapsible-content">
                  <div className="subs-collapsible-inner">
                    <SwipeToRevealGroup className="lp-card lp-group">
                      {archived.map((g) => (
                        <GroupRow key={g.id} group={g} onEdit={edit} onDelete={askDelete} />
                      ))}
                    </SwipeToRevealGroup>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>
      )}

      <CreateGroupSheet open={createOpen} onOpenChange={setCreateOpen} />
      {editData && (
        <GroupSettingsSheet
          key={`${editData.group.id}-${editData.group.name}`}
          open={editOpen}
          onOpenChange={setEditOpen}
          data={editData}
          meId={profile.user_id}
        />
      )}
      <ConfirmDeleteSheet
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t("groups.deleteTitle")}
        description={t(deleteData && deleteData.transfers.length > 0 ? "groups.deleteDescDebts" : "groups.deleteDesc")}
        confirmLabel={t("groups.delete")}
        pending={deleteGroup.isPending}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteGroup.mutateAsync(toDelete.id);
          } catch {
            return; // the error toast is already up; keep the confirmation to retry
          }
          setToDelete(null);
        }}
      />
    </div>
  );
}
