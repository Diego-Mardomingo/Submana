"use client";

import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { SheetButton } from "@/components/SheetFields";
import { Sheet, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { cn } from "@/lib/utils";

type Content = { title: ReactNode; description?: ReactNode; children?: ReactNode };

/**
 * What the sheet showed when it opened, so the text doesn't vanish during the closing animation
 * once the caller clears the item it was about (`toDelete = null`).
 */
function useContentWhileClosing(open: boolean, content: Content): Content {
  const [kept, setKept] = useState(content);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setKept(content);
  }
  return open ? content : kept;
}

/**
 * Confirmation for destructive or important actions, in the same sheet as the create / edit
 * forms (bottom sheet on phones, side panel on desktop).
 */
export function ConfirmSheet({ open, onOpenChange, title, description, children, icon, tone = "danger", confirmLabel, onConfirm, pending, disabled }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Extra warning under the description. */
  children?: ReactNode;
  icon?: ReactNode;
  tone?: "danger" | "warn";
  confirmLabel: ReactNode;
  onConfirm: () => void;
  pending?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations(useLang());
  const shown = useContentWhileClosing(open, { title, description, children });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={shown.title}>
      <SheetBody>
        <div className={cn("sf-confirm-hero", `sf-confirm-hero--${tone}`)}>
          <span className="sf-confirm-icon" aria-hidden>
            {icon ?? <Trash2 />}
          </span>
          {shown.description && <div className="sf-confirm-hero-text">{shown.description}</div>}
          {shown.children}
        </div>
      </SheetBody>
      <SheetFooter>
        <div className="sheet-footer-row">
          <SheetButton type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("common.cancel")}
          </SheetButton>
          <SheetButton type="button" variant={tone === "warn" ? "warn" : "danger"} onClick={onConfirm} pending={pending} disabled={disabled}>
            {confirmLabel}
          </SheetButton>
        </div>
      </SheetFooter>
    </Sheet>
  );
}

/** "Delete X?" confirmation shared by every list. */
export function ConfirmDeleteSheet(props: Omit<React.ComponentProps<typeof ConfirmSheet>, "confirmLabel" | "tone"> & { confirmLabel?: ReactNode }) {
  const t = useTranslations(useLang());
  return <ConfirmSheet {...props} confirmLabel={props.confirmLabel ?? t("common.delete")} />;
}
