"use client";

import { Chips, FieldGroup, FieldRow, FieldStack, RowInput, Segmented } from "@/components/SheetFields";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { useLang } from "@/hooks/useLang";
import { formatCurrency } from "@/lib/format";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { evaluateDraft, type SplitDraft } from "@/lib/shared/splitDraft";
import { fromCents, type SplitMode } from "@/lib/shared/splits";
import type { SharedProfile } from "@/lib/shared/types";
import { cn } from "@/lib/utils";

const MODES: SplitMode[] = ["equal", "exact", "percent", "shares"];

/** "You" for the current user, otherwise the display name. */
export function useMemberLabel(meId: string) {
  const t = useTranslations(useLang());
  return (profile: SharedProfile) => (profile.user_id === meId ? t("split.you") : profile.display_name);
}

/**
 * Who takes part in an expense and how it is divided: participants, mode (equal / exact amounts /
 * percentages / shares), per-person values with the resulting amount, a live "left to assign"
 * counter and the title the group will see.
 */
export function SplitEditor({ members, meId, totalCents, payerId, draft, onChange }: {
  members: SharedProfile[];
  meId: string;
  totalCents: number;
  payerId: string;
  draft: SplitDraft;
  onChange: (draft: SplitDraft) => void;
}) {
  const t = useTranslations(useLang());
  const label = useMemberLabel(meId);
  const evaluation = evaluateDraft(draft, totalCents, payerId);
  const patch = (changes: Partial<SplitDraft>) => onChange({ ...draft, ...changes });
  const included = members.filter((m) => draft.included.includes(m.user_id));

  const setValue = (userId: string, value: string) => patch({ values: { ...draft.values, [userId]: value } });
  const unit = draft.mode === "percent" ? "%" : draft.mode === "exact" ? "€" : "×";

  let counter: { text: string; tone: "ok" | "warn" } | null = null;
  if (draft.mode === "exact" && evaluation.remaining !== null) {
    counter =
      evaluation.remaining === 0
        ? { text: t("split.balanced"), tone: "ok" }
        : {
            text: interpolate(t(evaluation.remaining > 0 ? "split.left" : "split.over"), { amount: formatCurrency(Math.abs(fromCents(evaluation.remaining))) }),
            tone: "warn",
          };
  } else if (draft.mode === "percent" && evaluation.remaining !== null) {
    counter =
      evaluation.remaining === 0
        ? { text: t("split.balanced"), tone: "ok" }
        : { text: interpolate(t(evaluation.remaining > 0 ? "split.leftPercent" : "split.overPercent"), { percent: Math.abs(evaluation.remaining) }), tone: "warn" };
  } else if (!evaluation.result.ok && draft.included.length === 0) {
    counter = { text: t("split.noParticipants"), tone: "warn" };
  }

  return (
    <div className="split-editor">
      <FieldGroup>
        <FieldRow label={t("split.title")} htmlFor="split-title">
          <RowInput
            id="split-title"
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder={t("split.titlePlaceholder")}
            maxLength={120}
          />
        </FieldRow>
      </FieldGroup>

      <FieldGroup title={t("split.participants")}>
        <FieldStack>
          <Chips
            multiple
            label={t("split.participants")}
            value={draft.included}
            onChange={(ids) => patch({ included: members.map((m) => m.user_id).filter((id) => ids.includes(id)) })}
            options={members.map((m) => ({
              value: m.user_id,
              label: label(m),
              icon: <ProfileAvatar name={m.display_name} url={m.avatar_url} size={18} />,
            }))}
          />
        </FieldStack>
      </FieldGroup>

      <Segmented
        label={t("split.mode")}
        value={draft.mode}
        onChange={(mode) => patch({ mode })}
        options={MODES.map((mode) => ({ value: mode, label: t(`split.mode.${mode}` as const) }))}
      />

      {included.length > 0 && (
        <div className="lp-card lp-group split-rows">
          {included.map((member) => {
            const cents = evaluation.centsByUser.get(member.user_id);
            return (
              <div key={member.user_id} className="lp-row lp-row--static split-row">
                <ProfileAvatar name={member.display_name} url={member.avatar_url} size={32} />
                <span className="lp-main">
                  <span className="lp-title">
                    <span>{label(member)}</span>
                  </span>
                </span>
                {draft.mode !== "equal" && (
                  <label className="split-value">
                    <input
                      className="sf-input split-input"
                      inputMode="decimal"
                      aria-label={`${label(member)} (${unit})`}
                      value={draft.values[member.user_id] ?? ""}
                      placeholder={draft.mode === "shares" ? "1" : "0"}
                      onChange={(e) => setValue(member.user_id, e.target.value)}
                    />
                    <span aria-hidden>{unit}</span>
                  </label>
                )}
                <span className="split-amount">
                  {cents === undefined ? "—" : <SensitiveAmount>{formatCurrency(fromCents(cents))}</SensitiveAmount>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {counter && (
        <p className={cn("split-counter", counter.tone === "ok" ? "is-ok" : "is-warn")} role="status">
          {counter.text}
        </p>
      )}
    </div>
  );
}
