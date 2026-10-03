"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Receipt, Users } from "lucide-react";
import { toast } from "sonner";
import { HandleSetup } from "@/components/HandleSetup";
import { PageHeader } from "@/components/PageHeader";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { Chips, FieldGroup, FieldRow, FieldStack, FormError, RowInput, SheetButton } from "@/components/SheetFields";
import { Sheet, SheetBody, SheetFooter, SheetForm } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useFriends } from "@/hooks/useFriends";
import { useCreateGroup, useGroups, useOpenDirectGroup, useSharedBalances } from "@/hooks/useGroups";
import { useLang } from "@/hooks/useLang";
import { useProfile } from "@/hooks/useProfile";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { sharedErrorText } from "@/lib/shared/errorText";
import { groupTitle } from "@/lib/shared/groupName";
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

function GroupRow({ group, meId, label }: { group: GroupSummary; meId: string; label: string }) {
  const t = useTranslations(useLang());
  const others = group.members.filter((m) => m.user_id !== meId);
  return (
    <Link href={`/subcount/${group.id}`} className="lp-row">
      <span className="group-avatars" aria-hidden>
        {(group.kind === "direct" ? others : group.members).slice(0, 3).map((m) => (
          <ProfileAvatar key={m.user_id} name={m.display_name} url={m.avatar_url} size={32} />
        ))}
      </span>
      <span className="lp-main">
        <span className="lp-title">
          <span>{label}</span>
          {group.archived_at && <span className="lp-badge">{t("groups.archived")}</span>}
        </span>
        <span className="lp-meta">
          <span className="lp-truncate">
            {group.kind === "direct" ? `@${others[0]?.handle ?? ""}` : `${group.members.length} ${t("groups.membersCount")}`}
          </span>
        </span>
      </span>
      <span className="lp-end">
        <NetAmount cents={group.my_net_cents} />
        <span className="lp-sub-amount">{group.my_net_cents === 0 ? t("groups.settled") : t(group.my_net_cents > 0 ? "groups.owedToYou" : "groups.youOwe")}</span>
      </span>
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}

/** Groups page: balances with friends, groups and 1:1 splits. Asks for a @handle first when there is no profile. */
export default function GroupsBody() {
  const t = useTranslations(useLang());
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: groups = [], isLoading: groupsLoading } = useGroups(!!profile);
  const { data: balances } = useSharedBalances(!!profile);
  const { data: friends } = useFriends(!!profile);
  const openDirect = useOpenDirectGroup();
  const [createOpen, setCreateOpen] = useState(false);

  const header = (
    <PageHeader icon={<Receipt className="size-6" />} title={t("groups.title")} subtitle={t("groups.subtitle")}>
      {profile && (
        <button type="button" className="add-btn lp-add" onClick={() => setCreateOpen(true)} aria-label={t("groups.create")}>
          <Plus className="size-5" strokeWidth={2.5} aria-hidden />
          <span className="lp-add-label">{t("groups.create")}</span>
        </button>
      )}
    </PageHeader>
  );

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

  const withFriend = (friendId: string) =>
    openDirect.mutate(friendId, {
      onSuccess: (group) => router.push(`/subcount/${group.id}`),
      onError: (err) => toast.error(sharedErrorText(t, err.message)),
    });

  const direct = groups.filter((g) => g.kind === "direct");
  const multi = groups.filter((g) => g.kind === "group");
  const friendList = friends?.friends ?? [];

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
            <div className="lp-card lp-group">
              {balances.friends.map((f) => (
                <button key={f.profile.user_id} type="button" className="lp-row" onClick={() => withFriend(f.profile.user_id)} disabled={openDirect.isPending}>
                  <ProfileAvatar name={f.profile.display_name} url={f.profile.avatar_url} size={34} />
                  <span className="lp-main">
                    <span className="lp-title">
                      <span>{f.profile.display_name}</span>
                    </span>
                    <span className="lp-meta">
                      <span className="lp-truncate">@{f.profile.handle}</span>
                    </span>
                  </span>
                  <span className="lp-end">
                    <NetAmount cents={f.cents} />
                    <span className="lp-sub-amount">{t(f.cents > 0 ? "groups.owesYou" : "groups.youOwe")}</span>
                  </span>
                </button>
              ))}
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
              <SectionHead title={t("groups.list")} count={multi.length} />
              {multi.length === 0 ? (
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
                <div className="lp-card lp-group">
                  {multi.map((g) => (
                    <GroupRow key={g.id} group={g} meId={profile.user_id} label={groupTitle(g, g.members, profile.user_id)} />
                  ))}
                </div>
              )}
            </section>

            <section className="lp-section">
              <SectionHead title={t("groups.withFriends")} count={direct.length} />
              {direct.length > 0 && (
                <div className="lp-card lp-group">
                  {direct.map((g) => (
                    <GroupRow key={g.id} group={g} meId={profile.user_id} label={groupTitle(g, g.members, profile.user_id)} />
                  ))}
                </div>
              )}
              {friendList.length > 0 ? (
                <FieldGroup hint={t("groups.startWithFriend")}>
                  <FieldStack>
                    <Chips
                      label={t("groups.withFriends")}
                      value=""
                      onChange={withFriend}
                      options={friendList.map((f) => ({
                        value: f.profile.user_id,
                        label: f.profile.display_name,
                        icon: <ProfileAvatar name={f.profile.display_name} url={f.profile.avatar_url} size={18} />,
                      }))}
                    />
                  </FieldStack>
                </FieldGroup>
              ) : (
                <p className="lp-note">
                  {t("groups.noFriends")} <Link href="/friends" className="underline">{t("nav.friends")}</Link>
                </p>
              )}
            </section>
          </>
        )}
      </div>

      <CreateGroupSheet open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
