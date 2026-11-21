"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { SettleUpSheet } from "@/components/SettleUpSheet";
import { SharedExpenseSheet } from "@/components/SharedExpenseSheet";
import { ActionRow, FieldGroup } from "@/components/SheetFields";
import { Sheet, SheetBody } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useGroup, useGroups } from "@/hooks/useGroups";
import { useLang } from "@/hooks/useLang";
import { calendarDayInAppTimeZone } from "@/lib/date";
import { useProfile } from "@/hooks/useProfile";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { merchantName } from "@/lib/review/classify";
import type { ReviewItem } from "@/lib/review/types";
import { toCents } from "@/lib/shared/splits";

/** Share an expense in Subcount, or record an incoming Bizum as someone's payment there. */
export type GroupFlow = { kind: "share" | "settle"; item: ReviewItem };

type Step = "group" | "member" | "form";

/**
 * Picks the group (and, to settle, who paid me), then opens the app's own sheet filled in from the movement.
 * `onSaved` runs once the expense or the payment is saved.
 */
export function ReviewGroupFlow({ flow, onClose, onSaved }: { flow: GroupFlow | null; onClose: () => void; onSaved: (kind: GroupFlow["kind"]) => void }) {
  const t = useTranslations(useLang());
  const [step, setStep] = useState<Step>("group");
  const [groupId, setGroupId] = useState<string>();
  const [payerId, setPayerId] = useState<string>();
  const [current, setCurrent] = useState(flow);
  const { data: profile } = useProfile();
  const { data: groups = [], isLoading } = useGroups(!!flow);
  const { data: groupData } = useGroup(groupId);
  const group = groupData?.group.id === groupId ? groupData : undefined;

  // A new flow starts from the group list.
  if (flow !== current) {
    setCurrent(flow);
    if (flow) {
      setStep("group");
      setGroupId(undefined);
      setPayerId(undefined);
    }
  }

  const item = flow?.item;
  const close = (open: boolean) => !open && onClose();
  const active = groups.filter((g) => !g.archived_at);
  const others = group?.members.filter((m) => m.user_id !== profile?.user_id) ?? [];

  return (
    <>
      <Sheet
        // Stays up until the group's members arrive, so the next sheet replaces it directly.
        open={!!flow && (step === "group" || !group)}
        onOpenChange={close}
        title={t(flow?.kind === "settle" ? "review.settle.title" : "review.share.title")}
        description={item ? `${merchantName(item.description)} · ${formatCurrency(item.amount)}` : undefined}
      >
        <SheetBody>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Spinner className="size-6 text-muted-foreground" />
            </div>
          ) : (
            <FieldGroup title={t("review.group.title")}>
              {active.map((g) => (
                <ActionRow
                  key={g.id}
                  className="sf-action--group"
                  icon={
                    <span className="group-avatars" aria-hidden>
                      {g.members.slice(0, 3).map((m) => (
                        <ProfileAvatar key={m.user_id} name={m.display_name} url={m.avatar_url} size={28} />
                      ))}
                    </span>
                  }
                  onClick={() => {
                    setGroupId(g.id);
                    setStep(flow?.kind === "settle" ? "member" : "form");
                  }}
                >
                  <span className="sf-action-text">
                    {g.name}
                    <small>{`${g.members.length} ${t("groups.membersCount")}`}</small>
                  </span>
                  <ChevronRight className="sf-action-chevron" aria-hidden />
                </ActionRow>
              ))}
            </FieldGroup>
          )}
        </SheetBody>
      </Sheet>

      <Sheet open={!!flow && step === "member" && !!group} onOpenChange={close} title={t("review.settle.who")}>
        <SheetBody>
          <FieldGroup>
            {others.map((m) => (
              <ActionRow
                key={m.user_id}
                icon={<ProfileAvatar name={m.display_name} url={m.avatar_url} size={28} />}
                onClick={() => {
                  setPayerId(m.user_id);
                  setStep("form");
                }}
              >
                <span className="sf-action-text">{m.display_name}</span>
                <ChevronRight className="sf-action-chevron" aria-hidden />
              </ActionRow>
            ))}
          </FieldGroup>
        </SheetBody>
      </Sheet>

      {group && profile && item && flow?.kind === "share" && (
        <SharedExpenseSheet
          key={`${group.group.id}-${item.id}`}
          open={step === "form"}
          onOpenChange={close}
          groupId={group.group.id}
          members={group.members}
          meId={profile.user_id}
          prefill={{ title: merchantName(item.description) || item.pattern, amount: item.amount, date: calendarDayInAppTimeZone(item.date) }}
          onSaved={() => onSaved("share")}
        />
      )}
      {group && profile && item && flow?.kind === "settle" && (
        <SettleUpSheet
          open={step === "form" && !!payerId}
          onOpenChange={close}
          groupId={group.group.id}
          members={group.members}
          meId={profile.user_id}
          transfer={payerId ? { from: payerId, to: profile.user_id, cents: toCents(item.amount) } : null}
          date={calendarDayInAppTimeZone(item.date)}
          onSaved={() => onSaved("settle")}
        />
      )}
    </>
  );
}
