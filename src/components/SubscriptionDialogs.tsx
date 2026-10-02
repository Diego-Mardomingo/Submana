"use client";

import { XCircle } from "lucide-react";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { useLang } from "@/hooks/useLang";
import { useDeleteSubscription, useUpdateSubscription, type Subscription } from "@/hooks/useSubscriptions";
import { toDateString } from "@/lib/date";
import { useTranslations } from "@/lib/i18n/utils";

export type SubscriptionAction = { type: "cancel" | "delete"; sub: Subscription } | null;

/** "Every 2 months" style label. */
export function useFrequencyLabel() {
  const t = useTranslations(useLang());
  const plural = { weekly: "sub.weeks", monthly: "sub.months", yearly: "sub.years" } as const;
  return (sub: Pick<Subscription, "frequency" | "frequency_value">) => {
    const every = sub.frequency_value || 1;
    return every === 1 ? t(`sub.${sub.frequency}`) : `${t("sub.every")} ${every} ${t(plural[sub.frequency])}`;
  };
}

/** Confirmation sheets to cancel (end today) or delete a subscription. */
export function SubscriptionDialogs({ action, onClose, onDone }: {
  action: SubscriptionAction;
  onClose: () => void;
  onDone?: (type: "cancel" | "delete") => void;
}) {
  const lang = useLang();
  const t = useTranslations(lang);
  const es = lang === "es";
  const updateSub = useUpdateSubscription();
  const deleteSub = useDeleteSubscription();
  const isCancel = action?.type === "cancel";
  const pending = isCancel ? updateSub.isPending : deleteSub.isPending;

  const confirm = async () => {
    if (!action) return;
    if (isCancel) await updateSub.mutateAsync({ id: action.sub.id, end_date: toDateString(new Date()) });
    else await deleteSub.mutateAsync(action.sub.id);
    onClose();
    onDone?.(action.type);
  };

  return (
    <ConfirmSheet
      open={!!action}
      onOpenChange={(open) => !open && onClose()}
      tone={isCancel ? "warn" : "danger"}
      icon={isCancel ? <XCircle /> : undefined}
      title={isCancel ? (es ? "¿Cancelar suscripción?" : "Cancel subscription?") : t("sub.deleteTitle")}
      description={
        action &&
        (isCancel
          ? es
            ? `La fecha de fin de ${action.sub.service_name} pasará a ser hoy.`
            : `${action.sub.service_name}'s end date will be set to today.`
          : t("sub.deleteConfirm"))
      }
      confirmLabel={isCancel ? (es ? "Sí, cancelar" : "Yes, cancel") : es ? "Sí, eliminar" : "Yes, delete"}
      pending={pending}
      onConfirm={confirm}
    />
  );
}
