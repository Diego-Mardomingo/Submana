"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { Money } from "@/components/Money";
import { Chips, FieldGroup, FieldStack, SheetButton } from "@/components/SheetFields";
import { SplitEditor, useMemberLabel } from "@/components/SplitEditor";
import { Sheet, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { useGroups } from "@/hooks/useGroups";
import { useLang } from "@/hooks/useLang";
import { useProfile } from "@/hooks/useProfile";
import type { Subscription } from "@/hooks/useSubscriptions";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { draftParticipants, evaluateDraft, initialDraft, isDraftSubmittable, type SplitDraft } from "@/lib/shared/splitDraft";
import { fromCents } from "@/lib/shared/splits";
import type { SharedSplit } from "@/lib/shared/subscriptionSplit";

/** Editor state of a stored split (exact amounts in euros with a comma, like the expense form). */
export function draftFromSplit(split: SharedSplit | null | undefined, memberIds: string[]): SplitDraft {
  if (!split) return initialDraft(memberIds);
  const values: Record<string, string> = {};
  for (const p of split.participants) {
    if (p.value === undefined) continue;
    values[p.user_id] = split.mode === "exact" ? p.value.toFixed(2).replace(".", ",") : String(p.value);
  }
  return { mode: split.mode, included: split.participants.map((p) => p.user_id).filter((id) => memberIds.includes(id)), values, title: "" };
}

export interface SharingState {
  groupId: string;
  draft: SplitDraft | null;
}

/**
 * What the form sends: nothing when sharing wasn't touched, no group, or the group and a split that adds
 * up; `invalid` when it doesn't.
 */
export function sharingInput(state: SharingState, sub: Subscription | null, costCents: number, meId: string): { shared_group_id: string | null; shared_split: SharedSplit | null } | "invalid" | undefined {
  if (!state.groupId) return sub?.shared_group_id ? { shared_group_id: null, shared_split: null } : undefined;
  if (!state.draft) return state.groupId === sub?.shared_group_id ? undefined : "invalid";
  if (!isDraftSubmittable(evaluateDraft(state.draft, Math.max(costCents, 1), meId), state.draft)) return "invalid";
  return { shared_group_id: state.groupId, shared_split: { mode: state.draft.mode, participants: draftParticipants(state.draft) } };
}

/** Initial sharing state of the form. */
export function initialSharing(sub: Subscription | null): SharingState {
  return { groupId: sub?.shared_group_id ?? "", draft: null };
}

/**
 * "Share in Subcount" in the subscription form: pick one of my groups and how each charge is split (the
 * same editor as a group expense, in its own sheet), with what each person pays at the current price.
 */
export function SubscriptionSharingFields({ sub, state, onChange, costCents }: {
  sub: Subscription | null;
  state: SharingState;
  onChange: (state: SharingState) => void;
  costCents: number;
}) {
  const t = useTranslations(useLang());
  const { data: groups = [] } = useGroups();
  const { data: profile } = useProfile();
  const meId = profile?.user_id ?? "";
  const label = useMemberLabel(meId);
  const [editing, setEditing] = useState(false);
  const active = groups.filter((g) => !g.archived_at || g.id === state.groupId);
  const group = active.find((g) => g.id === state.groupId);
  if (active.length === 0 || !meId) return null;

  const memberIds = group?.members.map((m) => m.user_id) ?? [];
  // The stored split is turned into an editor draft once the group's members are known.
  const draft = state.draft ?? (group ? draftFromSplit(state.groupId === sub?.shared_group_id ? sub?.shared_split : null, memberIds) : null);
  const evaluation = draft ? evaluateDraft(draft, Math.max(costCents, 1), meId) : null;
  const mode = draft ? t(`split.mode.${draft.mode}` as const) : "";

  return (
    <FieldGroup title={t("sub.share.title")} hint={group ? interpolate(t("sub.share.hint"), { group: group.name }) : t("sub.share.hintNone")}>
      <FieldStack>
        <Chips
          scroll
          label={t("sub.share.title")}
          value={state.groupId}
          onChange={(groupId) => {
            const next = active.find((g) => g.id === groupId);
            onChange({ groupId, draft: next ? draftFromSplit(groupId === sub?.shared_group_id ? sub?.shared_split : null, next.members.map((m) => m.user_id)) : null });
          }}
          options={[{ value: "", label: t("sub.share.none") }, ...active.map((g) => ({ value: g.id, label: g.name }))]}
        />
      </FieldStack>
      {group && draft && evaluation && (
        <>
          <button type="button" className="sf-row sf-action" onClick={() => setEditing(true)}>
            <span>{t("sub.share.split")}</span>
            <span className="sf-row-value">
              {mode} · {draft.included.length}
            </span>
            <ChevronRight className="sf-action-chevron" aria-hidden />
          </button>
          {group.members
            .filter((m) => draft.included.includes(m.user_id))
            .map((m) => {
              const cents = evaluation.centsByUser.get(m.user_id);
              return (
                <div key={m.user_id} className="sf-share">
                  <ProfileAvatar name={m.display_name} url={m.avatar_url} size={28} />
                  <span className="sf-share-name">{label(m)}</span>
                  <span className="sf-share-amount">{cents === undefined ? "—" : <Money value={fromCents(cents)} />}</span>
                </div>
              );
            })}
          <Sheet open={editing} onOpenChange={setEditing} title={t("sub.share.split")}>
            <SheetBody>
              <SplitEditor
                members={group.members}
                meId={meId}
                totalCents={Math.max(costCents, 1)}
                payerId={meId}
                draft={draft}
                onChange={(next) => onChange({ groupId: state.groupId, draft: next })}
                showTitle={false}
              />
            </SheetBody>
            <SheetFooter>
              <SheetButton type="button" onClick={() => setEditing(false)} disabled={!isDraftSubmittable(evaluation, draft)}>
                {t("sub.share.done")}
              </SheetButton>
            </SheetFooter>
          </Sheet>
        </>
      )}
    </FieldGroup>
  );
}
