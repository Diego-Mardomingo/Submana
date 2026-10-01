"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
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

/** Confirmation dialogs to cancel (end today) or delete a subscription. */
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
    <Dialog open={!!action} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader className="items-center">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full ${isCancel ? "bg-[var(--warning-soft)]" : "bg-[var(--danger-soft)]"}`}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={isCancel ? "var(--warning)" : "var(--danger)"} strokeWidth="2">
              {isCancel ? (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M15 9l-6 6M9 9l6 6" />
                </>
              ) : (
                <>
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </>
              )}
            </svg>
          </div>
          <DialogTitle className="text-center">
            {isCancel ? (es ? "¿Cancelar suscripción?" : "Cancel subscription?") : t("sub.deleteTitle")}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isCancel
              ? es
                ? `Se establecerá la fecha de fin de ${action.sub.service_name} como hoy.`
                : `This will set ${action.sub.service_name}'s end date to today.`
              : t("sub.deleteConfirm")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>
            {t("sub.cancelAction")}
          </Button>
          <Button
            variant={isCancel ? "default" : "destructive"}
            onClick={confirm}
            disabled={pending}
            className={isCancel ? "bg-[var(--warning)] hover:bg-[var(--warning-hover)] text-black" : undefined}
          >
            {pending && <Spinner className="size-4" />}
            {t(isCancel ? "sub.cancel" : "sub.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
