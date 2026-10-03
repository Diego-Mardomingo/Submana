"use client";

import Link from "next/link";
import { AlertTriangle, Link2Off, Users } from "lucide-react";
import { toast } from "sonner";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { ActionRow, Chips, FieldGroup, FieldStack, InfoRow } from "@/components/SheetFields";
import { SplitEditor } from "@/components/SplitEditor";
import { useFriends } from "@/hooks/useFriends";
import { useGroups } from "@/hooks/useGroups";
import { useLang } from "@/hooks/useLang";
import { useProfile } from "@/hooks/useProfile";
import { useUnlinkSharedTransaction } from "@/hooks/useSharedExpenses";
import type { Transaction } from "@/hooks/useTransactions";
import { formatCurrency } from "@/lib/format";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { sharedErrorText } from "@/lib/shared/errorText";
import { initialDraft, type SplitDraft } from "@/lib/shared/splitDraft";
import type { SharedProfile } from "@/lib/shared/types";

/** Split chosen in the transaction form: a group id or `friend:<userId>` plus the editor state. */
export interface SplitSelection {
  target: string;
  draft: SplitDraft;
}

export const FRIEND_PREFIX = "friend:";

/** Members of the chosen target (me first), or null while nothing is chosen. */
export function useSplitMembers(selection: SplitSelection | null): SharedProfile[] | null {
  const { data: profile } = useProfile();
  const { data: groups = [] } = useGroups(!!profile && !!selection);
  const { data: friends } = useFriends(!!profile && !!selection);
  if (!selection?.target || !profile) return null;
  const me: SharedProfile = { user_id: profile.user_id, handle: profile.handle, display_name: profile.display_name, avatar_url: profile.avatar_url };
  if (selection.target.startsWith(FRIEND_PREFIX)) {
    const friend = friends?.friends.find((f) => f.profile.user_id === selection.target.slice(FRIEND_PREFIX.length));
    return friend ? [me, friend.profile] : null;
  }
  const group = groups.find((g) => g.id === selection.target);
  if (!group) return null;
  return [me, ...group.members.filter((m) => m.user_id !== me.user_id)];
}

/** "Split with…" for an expense: pick a group or a friend, then divide it. */
export function TransactionSplitSection({ selection, onChange, totalCents, description, bankDescription }: {
  selection: SplitSelection | null;
  onChange: (selection: SplitSelection | null) => void;
  totalCents: number;
  description: string;
  bankDescription?: string | null;
}) {
  const t = useTranslations(useLang());
  const { data: profile } = useProfile();
  const { data: groups = [] } = useGroups(!!profile);
  const { data: friends } = useFriends(!!profile);
  const members = useSplitMembers(selection);

  if (!profile) {
    return (
      <FieldGroup hint={t("split.needProfile")}>
        <Link href="/subcount" className="sf-row sf-action">
          <Users aria-hidden />
          <span>{t("split.with")}</span>
        </Link>
      </FieldGroup>
    );
  }

  if (!selection) {
    return (
      <FieldGroup>
        <ActionRow tone="accent" icon={<Users aria-hidden />} onClick={() => onChange({ target: "", draft: initialDraft([]) })}>
          {t("split.with")}
        </ActionRow>
      </FieldGroup>
    );
  }

  const activeGroups = groups.filter((g) => g.kind === "group" && !g.archived_at);
  const friendList = friends?.friends ?? [];
  const choose = (target: string) => {
    if (target === selection.target) return;
    // Members come from the lists (the hook for the new target hasn't rendered yet).
    const ids = target.startsWith(FRIEND_PREFIX)
      ? [profile.user_id, target.slice(FRIEND_PREFIX.length)]
      : [profile.user_id, ...(groups.find((g) => g.id === target)?.members.map((m) => m.user_id).filter((id) => id !== profile.user_id) ?? [])];
    onChange({ target, draft: initialDraft(ids, selection.draft.title) });
  };

  return (
    <FieldGroup title={t("split.with")} hint={activeGroups.length + friendList.length === 0 ? t("split.noTargets") : undefined}>
      <FieldStack>
        <Chips
          scroll
          label={t("split.with")}
          value={selection.target}
          onChange={choose}
          options={[
            ...activeGroups.map((g) => ({ value: g.id, label: g.name, icon: <Users className="size-4" aria-hidden /> })),
            ...friendList.map((f) => ({
              value: `${FRIEND_PREFIX}${f.profile.user_id}`,
              label: f.profile.display_name,
              icon: <ProfileAvatar name={f.profile.display_name} url={f.profile.avatar_url} size={18} />,
            })),
          ]}
        />
      </FieldStack>
      {members && (
        <SplitEditor
          members={members}
          meId={profile.user_id}
          totalCents={totalCents}
          payerId={profile.user_id}
          draft={selection.draft}
          onChange={(draft) => onChange({ ...selection, draft })}
          bankDescription={description.trim() || bankDescription || undefined}
        />
      )}
      <ActionRow icon={<Link2Off aria-hidden />} onClick={() => onChange(null)}>
        {t("split.cancel")}
      </ActionRow>
    </FieldGroup>
  );
}

/** Info for a bank row already tied to a shared expense or settlement (my share, group link, mismatch, unlink). */
export function LinkedSharedInfo({ transaction }: { transaction: Transaction }) {
  const t = useTranslations(useLang());
  const unlink = useUnlinkSharedTransaction();
  const shared = transaction.shared_expense;
  if (!shared) return null;
  const settlement = shared.kind === "settlement";
  const mismatch = !settlement && Math.abs(Number(transaction.amount) - Number(shared.total_amount)) > 0.005;

  return (
    <FieldGroup title={t(settlement ? "shared.settlement" : "split.linked")}>
      {!settlement && (
        <InfoRow label={shared.title}>
          {t("shared.yourShareLabel")} <SensitiveAmount>{formatCurrency(Number(transaction.metric_amount ?? transaction.amount))}</SensitiveAmount>
        </InfoRow>
      )}
      {settlement && <InfoRow label={t("shared.settlement")}>{t("shared.notInMetrics")}</InfoRow>}
      {mismatch && (
        <p className="shared-mismatch" role="alert">
          <AlertTriangle className="size-4" aria-hidden />
          <span>
            {interpolate(t("shared.mismatch"), { total: formatCurrency(Number(shared.total_amount)), bank: formatCurrency(Number(transaction.amount)) })}{" "}
            <Link href={`/subcount/${shared.group_id}`} className="underline">
              {t("shared.openGroup")}
            </Link>
          </span>
        </p>
      )}
      <Link href={`/subcount/${shared.group_id}`} className="sf-row sf-action sf-action--accent">
        <Users aria-hidden />
        <span>{t("shared.openGroup")}</span>
      </Link>
      <ActionRow
        icon={<Link2Off aria-hidden />}
        disabled={unlink.isPending}
        onClick={() => unlink.mutate(shared.id, { onError: (err) => toast.error(sharedErrorText(t, err.message)) })}
      >
        {t("split.unlink")}
      </ActionRow>
    </FieldGroup>
  );
}

/** Read-only summary of a virtual row (a friend paid): only the category and description are editable. */
export function VirtualRowInfo({ transaction }: { transaction: Transaction }) {
  const t = useTranslations(useLang());
  const shared = transaction.shared_expense;
  return (
    <FieldGroup hint={t("shared.virtualHint")}>
      <InfoRow label={t("shared.paidByLabel")}>{shared?.paid_by_handle ? `@${shared.paid_by_handle}` : "—"}</InfoRow>
      <InfoRow label={t("shared.yourShareLabel")}>
        <SensitiveAmount>{formatCurrency(Number(transaction.amount))}</SensitiveAmount>
      </InfoRow>
      {shared && (
        <Link href={`/subcount/${shared.group_id}`} className="sf-row sf-action sf-action--accent">
          <Users aria-hidden />
          <span>{t("shared.openGroup")}</span>
        </Link>
      )}
    </FieldGroup>
  );
}
