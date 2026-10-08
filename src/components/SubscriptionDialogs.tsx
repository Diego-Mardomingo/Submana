"use client";

import { XCircle } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useUndoableDeleteSubscription, useUpdateSubscription, type Subscription } from "@/hooks/useSubscriptions";
import { toDateString } from "@/lib/date";
import { useTranslations } from "@/lib/i18n/utils";
import { toast } from "@/lib/toast";

/** "Every 2 months" style label. */
export function useFrequencyLabel() {
  const t = useTranslations(useLang());
  const plural = { weekly: "sub.weeks", monthly: "sub.months", yearly: "sub.years" } as const;
  return (sub: Pick<Subscription, "frequency" | "frequency_value">) => {
    const every = sub.frequency_value || 1;
    return every === 1 ? t(`sub.${sub.frequency}`) : `${t("sub.every")} ${every} ${t(plural[sub.frequency])}`;
  };
}

/**
 * Cancel (end today) and delete a subscription. Neither asks first: both show a toast with Undo
 * (cancel restores the previous end date; delete is only sent when the toast closes).
 */
export function useSubscriptionActions() {
  const t = useTranslations(useLang());
  const updateSub = useUpdateSubscription();
  const deleteSub = useUndoableDeleteSubscription();

  const cancel = async (sub: Pick<Subscription, "id" | "end_date">) => {
    const previous = sub.end_date ?? null;
    try {
      await updateSub.mutateAsync({ id: sub.id, end_date: toDateString(new Date()) });
    } catch {
      return; // the error toast is already up
    }
    toast(t("sub.cancelled"), {
      icon: <XCircle />,
      action: { label: t("common.undo"), onClick: () => updateSub.mutate({ id: sub.id, end_date: previous }) },
    });
  };

  return { cancel, remove: deleteSub };
}
