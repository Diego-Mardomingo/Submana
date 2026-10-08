"use client";

import { Check, UserPlus, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { DeleteAction, FieldGroup } from "@/components/SheetFields";
import {
  useAccountInvites,
  useInviteAccountMember,
  useRemoveAccountMember,
  useRespondAccountInvite,
  type Account,
  type AccountInvite,
} from "@/hooks/useAccounts";
import { useFriends } from "@/hooks/useFriends";
import { useLang } from "@/hooks/useLang";
import { useProfile } from "@/hooks/useProfile";
import { canEditAccount } from "@/lib/accountAccess";
import { interpolate, useTranslations } from "@/lib/i18n/utils";

function MemberRow({ name, handle, avatarUrl, detail, action }: { name: string; handle?: string; avatarUrl?: string | null; detail: string; action?: React.ReactNode }) {
  return (
    <div className="lp-row lp-row--static">
      <ProfileAvatar name={name} url={avatarUrl} size={34} />
      <span className="lp-main">
        <span className="lp-title">
          <span>{name}</span>
        </span>
        <span className="lp-meta">
          <span className="lp-truncate">{handle ? `@${handle} · ${detail}` : detail}</span>
        </span>
      </span>
      {action && <div className="flex items-center gap-1 shrink-0">{action}</div>}
    </div>
  );
}

const iconButton = "lp-icon-btn";

/**
 * Members of a joint account and (for the owner) the friend picker to invite more people.
 * A member who is not the owner can leave. Only shown for existing accounts.
 */
export function JointAccountSection({ account, onLeft }: { account: Account; onLeft?: () => void }) {
  const t = useTranslations(useLang());
  const { data: me } = useProfile();
  const { data: friendsData } = useFriends();
  const invite = useInviteAccountMember();
  const remove = useRemoveAccountMember();

  const isOwner = canEditAccount(account.my_role ?? "owner", "members");
  const members = account.members ?? [];
  const taken = new Set(members.map((m) => m.user_id));
  const candidates = (friendsData?.friends ?? []).filter((f) => !taken.has(f.profile.user_id));

  return (
    <FieldGroup title={t("joint.title")} hint={account.is_joint ? t("joint.excluded") : t("joint.inviteHint")}>
      {members.map((member) => {
        const isMe = member.user_id === me?.user_id;
        const name = member.profile?.display_name ?? "?";
        const detail = [member.role === "owner" ? t("joint.owner") : t("joint.member"), member.status === "pending" ? t("joint.pending") : null]
          .filter(Boolean)
          .join(" · ");
        const removable = isOwner && member.role !== "owner";
        return (
          <MemberRow
            key={member.user_id}
            name={name}
            handle={isMe ? undefined : member.profile?.handle}
            avatarUrl={member.profile?.avatar_url}
            detail={detail}
            action={
              removable && (
                <button
                  type="button"
                  className={iconButton}
                  aria-label={member.status === "pending" ? t("joint.cancelInvite") : t("joint.remove")}
                  title={member.status === "pending" ? t("joint.cancelInvite") : t("joint.remove")}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ accountId: account.id, userId: member.user_id })}
                >
                  <X className="size-4" />
                </button>
              )
            }
          />
        );
      })}

      {isOwner && (
        <>
          {candidates.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">{(friendsData?.friends.length ?? 0) === 0 ? t("joint.noFriends") : t("joint.noMoreFriends")}</p>
          ) : (
            candidates.map((friend) => (
              <MemberRow
                key={friend.profile.user_id}
                name={friend.profile.display_name}
                handle={friend.profile.handle}
                avatarUrl={friend.profile.avatar_url}
                detail={t("joint.invite")}
                action={
                  <button
                    type="button"
                    className={iconButton}
                    style={{ color: "var(--accent)" }}
                    aria-label={`${t("joint.invite")}: @${friend.profile.handle}`}
                    title={t("joint.invite")}
                    disabled={invite.isPending}
                    onClick={() =>
                      invite.mutate(
                        { accountId: account.id, friendId: friend.profile.user_id },
                        { onSuccess: () => toast.success(t("joint.inviteSent")) }
                      )
                    }
                  >
                    <UserPlus className="size-4" />
                  </button>
                }
              />
            ))
          )}
        </>
      )}

      {!isOwner && me && (
        <DeleteAction
          label={t("joint.leave")}
          confirmTitle={t("joint.leaveTitle")}
          confirmText={t("joint.leaveDesc")}
          confirmLabel={t("joint.leave")}
          pending={remove.isPending}
          onConfirm={async () => {
            try {
              await remove.mutateAsync({ accountId: account.id, userId: me.user_id });
            } catch {
              return; // the error toast is already up; stay to retry
            }
            toast.info(t("joint.left"));
            onLeft?.();
          }}
        />
      )}
    </FieldGroup>
  );
}

/** Pending joint-account invitations with accept / decline; renders nothing when there are none. */
export function JointInvites({ className }: { className?: string }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: invites = [] } = useAccountInvites();
  const respond = useRespondAccountInvite();
  if (invites.length === 0) return null;

  const answer = (invite: AccountInvite, accept: boolean) =>
    respond.mutate({ accountId: invite.account_id, accept }, { onSuccess: () => accept && toast.success(t("joint.accepted")) });

  return (
    <section className={className ?? "lp-section"}>
      <div className="lp-section-head">
        <span className="lp-section-title">
          {t("joint.invites")}
          <small>{invites.length}</small>
        </span>
      </div>
      <div className="lp-card lp-group">
        {invites.map((invite) => (
          <MemberRow
            key={invite.account_id}
            name={invite.name}
            avatarUrl={invite.owner?.avatar_url}
            detail={interpolate(t("joint.invitedBy"), { name: invite.owner ? `@${invite.owner.handle}` : "?" })}
            action={
              <>
                <button type="button" className={iconButton} style={{ color: "var(--accent)" }} aria-label={t("joint.accept")} title={t("joint.accept")} disabled={respond.isPending} onClick={() => answer(invite, true)}>
                  <Check className="size-4" />
                </button>
                <button type="button" className={iconButton} aria-label={t("joint.decline")} title={t("joint.decline")} disabled={respond.isPending} onClick={() => answer(invite, false)}>
                  <X className="size-4" />
                </button>
              </>
            }
          />
        ))}
      </div>
    </section>
  );
}
