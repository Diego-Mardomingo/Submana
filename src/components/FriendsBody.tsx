"use client";

import { useState } from "react";
import { Check, UserMinus, UserPlus, Users, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { HandleSetup } from "@/components/HandleSetup";
import { JointInvites } from "@/components/JointAccountSection";
import { PageHeader } from "@/components/PageHeader";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { FieldGroup, FieldRow, FormError, RowInput, SheetButton } from "@/components/SheetFields";
import { Spinner } from "@/components/ui/spinner";
import { useDeleteFriendship, useFriends, useRespondFriendRequest, useSendFriendRequest, type FriendItem } from "@/hooks/useFriends";
import { useLang } from "@/hooks/useLang";
import { useProfile } from "@/hooks/useProfile";
import { normalizeHandle } from "@/lib/handles";
import type { UIKey } from "@/lib/i18n/ui";
import { useTranslations } from "@/lib/i18n/utils";

function FriendRow({ item, children }: { item: FriendItem; children: React.ReactNode }) {
  return (
    <div className="lp-row lp-row--static">
      <ProfileAvatar name={item.profile.display_name} url={item.profile.avatar_url} size={38} />
      <span className="lp-main">
        <span className="lp-title">
          <span>{item.profile.display_name}</span>
        </span>
        <span className="lp-meta">
          <span className="lp-truncate">@{item.profile.handle}</span>
        </span>
      </span>
      <div className="flex items-center gap-1 shrink-0">{children}</div>
    </div>
  );
}

function IconAction({ label, onClick, disabled, tone, children }: { label: string; onClick: () => void; disabled?: boolean; tone?: "accent"; children: React.ReactNode }) {
  return (
    <button type="button" className="lp-icon-btn" style={tone ? { color: "var(--accent)" } : undefined} aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

const SectionHead = ({ title, count }: { title: string; count?: number }) => (
  <div className="lp-section-head">
    <span className="lp-section-title">
      {title}
      {count ? <small>{count}</small> : null}
    </span>
  </div>
);

/** Friends page: add by @handle, pending requests and the friends list. Asks for a @handle first when there is no profile. */
export default function FriendsBody() {
  const t = useTranslations(useLang());
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data, isLoading: friendsLoading } = useFriends(!!profile);
  const send = useSendFriendRequest();
  const respond = useRespondFriendRequest();
  const remove = useDeleteFriendship();
  const [handleInput, setHandleInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<FriendItem | null>(null);

  const errorText = (code: string) => {
    const key = `friends.error.${code}` as UIKey;
    const text = t(key);
    return text === key ? t("friends.error.generic") : text;
  };
  const failure = (err: Error) => toast.error(errorText(err.message));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const handle = normalizeHandle(handleInput);
    if (!handle || send.isPending) return;
    setError(null);
    send.mutate(handle, {
      onSuccess: (friendship: { status?: string }) => {
        setHandleInput("");
        toast.success(t(friendship?.status === "accepted" ? "friends.add.accepted" : "friends.add.sent"));
      },
      onError: (err) => setError(errorText(err.message)),
    });
  };

  const header = <PageHeader icon={<Users className="size-6" />} title={t("friends.title")} subtitle={t("friends.subtitle")} />;

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

  const { friends = [], incoming = [], outgoing = [] } = data ?? {};

  return (
    <div className="page-container lp-page fade-in">
      {header}
      <div className="lp-sections mx-auto w-full max-w-xl">
        <section className="lp-section">
          <SectionHead title={t("friends.add.title")} />
          <form onSubmit={submit} className="flex flex-col gap-2">
            <FieldGroup>
              <FieldRow label="@" htmlFor="friend-handle">
                <RowInput
                  id="friend-handle"
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  placeholder={t("friends.add.placeholder")}
                  maxLength={21}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </FieldRow>
            </FieldGroup>
            <FormError>{error}</FormError>
            <SheetButton type="submit" pending={send.isPending} disabled={!normalizeHandle(handleInput)}>
              <UserPlus className="size-4" />
              {t("friends.add.send")}
            </SheetButton>
          </form>
        </section>

        {friendsLoading ? (
          <div className="flex items-center justify-center min-h-[6rem]">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        ) : (
          <>
            <JointInvites />

            {incoming.length > 0 && (
              <section className="lp-section">
                <SectionHead title={t("friends.incoming")} count={incoming.length} />
                <div className="lp-card lp-group">
                  {incoming.map((item) => (
                    <FriendRow key={item.id} item={item}>
                      <IconAction label={t("friends.accept")} tone="accent" onClick={() => respond.mutate({ id: item.id, accept: true }, { onError: failure })}>
                        <Check className="size-4" />
                      </IconAction>
                      <IconAction label={t("friends.decline")} onClick={() => respond.mutate({ id: item.id, accept: false }, { onError: failure })}>
                        <X className="size-4" />
                      </IconAction>
                    </FriendRow>
                  ))}
                </div>
              </section>
            )}

            {outgoing.length > 0 && (
              <section className="lp-section">
                <SectionHead title={t("friends.outgoing")} count={outgoing.length} />
                <div className="lp-card lp-group">
                  {outgoing.map((item) => (
                    <FriendRow key={item.id} item={item}>
                      <IconAction label={t("friends.cancel")} onClick={() => remove.mutate(item.id, { onError: failure })}>
                        <X className="size-4" />
                      </IconAction>
                    </FriendRow>
                  ))}
                </div>
              </section>
            )}

            <section className="lp-section">
              <SectionHead title={t("friends.list")} count={friends.length} />
              {friends.length === 0 ? (
                <div className="lp-card lp-empty">
                  <div className="lp-empty-icon">
                    <Users />
                  </div>
                  <p className="lp-empty-text">{t("friends.empty")}</p>
                </div>
              ) : (
                <div className="lp-card lp-group">
                  {friends.map((item) => (
                    <FriendRow key={item.id} item={item}>
                      <IconAction label={t("friends.remove")} onClick={() => setToRemove(item)}>
                        <UserMinus className="size-4" />
                      </IconAction>
                    </FriendRow>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <ConfirmSheet
        open={!!toRemove}
        onOpenChange={(open) => !open && setToRemove(null)}
        icon={<UserMinus />}
        title={t("friends.removeTitle")}
        description={toRemove ? `${toRemove.profile.display_name} (@${toRemove.profile.handle}). ${t("friends.removeDesc")}` : undefined}
        confirmLabel={t("friends.remove")}
        pending={remove.isPending}
        onConfirm={() => {
          if (!toRemove) return;
          remove.mutate(toRemove.id, { onError: failure });
          setToRemove(null);
        }}
      />
    </div>
  );
}
