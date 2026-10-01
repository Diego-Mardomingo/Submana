"use client";

import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";

/** Destructive confirmation dialog shared by every "delete X" action. */
export function ConfirmDeleteDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Extra warning rendered under the description. */
  children?: ReactNode;
  onConfirm: () => void;
  pending?: boolean;
  disabled?: boolean;
}) {
  const { open, onOpenChange, title, description, children, onConfirm, pending, disabled } = props;
  const t = useTranslations(useLang());
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--danger-soft)] mx-auto mb-2">
            <Trash2 className="h-6 w-6 text-[var(--danger)]" />
          </div>
          <AlertDialogTitle className="text-center">{title}</AlertDialogTitle>
          {description && <AlertDialogDescription className="text-center">{description}</AlertDialogDescription>}
          {children}
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center gap-3">
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm} disabled={pending || disabled}>
            {pending && <Spinner className="size-4 mr-2" />}
            {t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Warning shown when deleting an account that still has transactions. */
export function AccountTransactionsWarning({ count }: { count: number }) {
  const es = useLang() === "es";
  if (count <= 0) return null;
  return (
    <div className="mt-3 p-3 rounded-lg bg-[var(--danger-soft)] border border-[var(--danger)] text-center">
      <p className="text-sm font-medium text-[var(--danger)]">
        {es
          ? `Se eliminarán ${count} transaccion${count === 1 ? "" : "es"} asociadas a esta cuenta`
          : `${count} transaction${count === 1 ? "" : "s"} associated with this account will be deleted`}
      </p>
    </div>
  );
}
