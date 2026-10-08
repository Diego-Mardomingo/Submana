"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Pencil, Trash2, Users } from "lucide-react";
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
import { Sheet, SheetBody, SheetFooter, SheetForm } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useFriends } from "@/hooks/useFriends";
import { useCreateGroup, useDeleteGroup, useGroup, useGroups, useSharedBalances } from "@/hooks/useGroups";
import { useLang } from "@/hooks/useLang";
import { useProfile } from "@/hooks/useProfile";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { sharedErrorText } from "@/lib/shared/errorText";
import { fromCents } from "@/lib/shared/splits";
import type { GroupSummary } from "@/lib/shared/types";
import { cn } from "@/lib/utils";

const SectionHead = ({ title, count }: { title: string; count?: number }) => (
  <div className="lp-section-head">
    <span className="lp-section-title">
      {title}
      {count ? <small>{count}</small> : null}
    </span>
  </div>
);

/** Signed amount with the "owes you / you owe" colouring. */
export function NetAmount({ cents, className }: { cents: number; className?: string }) {
  return (
    <span className={cn("lp-amount", cents > 0 ? "is-income" : cents < 0 ? "is-expense" : "is-muted", className)}>
      <SensitiveAmount>
        {cents === 0 ? formatCurrency(0) : `${cents > 0 ? "+" : "-"}${formatCurrency(Math.abs(fromCents(cents)))}`}
      </SensitiveAmount>
    </span>
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
        <span className="group-avatars" aria-hidden>
          {group.members.slice(0, 3).map((m) => (
            <ProfileAvatar key={m.user_id} name={m.display_name} url={m.avatar_url} size={32} />
          ))}
        </span>
        <span className="lp-main">
          <span className="lp-title">
            <span>{group.name}</span>
          </span>
          <span className="lp-meta">
            <span className="lp-truncate">{`${group.members.length} ${t("groups.membersCount")}`}</span>
          </span>
        </span>
        <span className="lp-end">
          <NetAmount cents={group.my_net_cents} />
          <span className="lp-sub-amount">{group.my_net_cents === 0 ? t("groups.settled") : t(group.my_net_cents > 0 ? "groups.owedToYou" : "groups.youOwe")}</span>
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
      <div className="lp-sections mx-auto w-full max-w-xl">
        {balances && (balances.owed_to_me_cents > 0 || balances.i_owe_cents > 0) && (
          <section className="lp-section">
            <SectionHead title={t("groups.balances")} />
            <div className="lp-card group-balance-summary">
              <div>
                <span className="lp-label">{t("groups.friendsOweYou")}</span>
                <NetAmount cents={balances.owed_to_me_cents} />
              </div>
              <div>
                <span className="lp-label">{t("groups.youOweTotal")}</span>
                <NetAmount cents={-balances.i_owe_cents} />
              </div>
            </div>
          </section>
        )}

        {groupsLoading ? (
          <div className="flex items-center justify-center min-h-[6rem]">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        ) : (
          <>
            <section className="lp-section">
              <SectionHead title={t("groups.list")} count={active.length} />
              {active.length === 0 ? (
                <div className="lp-card lp-empty">
                  <div className="lp-empty-icon">
                    <Users />
                  </div>
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
          </>
        )}
      </div>

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
          if (toDelete) await deleteGroup.mutateAsync(toDelete.id).catch((err: Error) => toast.error(sharedErrorText(t, err.message)));
          setToDelete(null);
        }}
      />
    </div>
  );
}
