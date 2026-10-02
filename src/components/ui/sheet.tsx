"use client";

import { useRef, useState } from "react";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useLang } from "@/hooks/useLang";
import { cn } from "@/lib/utils";

const MOBILE_QUERY = "(max-width: 767px)";
/** Dragging the sheet down further than this (or flicking it) dismisses it. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.5;

/**
 * Keeps showing the last payload while the sheet plays its closing animation, after the parent
 * has already cleared it (e.g. `editing` set back to null).
 */
export function useSheetPayload<T>(open: boolean, payload: T): T {
  const [kept, setKept] = useState(payload);
  if (open && payload !== kept) setKept(payload);
  return open ? payload : kept;
}

/**
 * Modal panel for creating and editing: a bottom sheet that can be dragged down to close on
 * phones, a panel sliding in from the right from tablet up. The page behind is dimmed.
 */
export function Sheet({ open, onOpenChange, title, description, headerAction, className, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Extra button next to the close button (e.g. "Edit" on a detail view). */
  headerAction?: React.ReactNode;
  className?: string;
  /** `SheetBody` and an optional `SheetFooter`, or a form wrapping both. */
  children: React.ReactNode;
}) {
  const es = useLang() === "es";
  const contentRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ y: number; time: number; dy: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !matchMedia(MOBILE_QUERY).matches || (e.target as Element).closest("button, a, input")) return;
    drag.current = { y: e.clientY, time: Date.now(), dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    contentRef.current?.style.setProperty("transition", "none");
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !contentRef.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    contentRef.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onPointerUp = () => {
    const el = contentRef.current;
    const state = drag.current;
    drag.current = null;
    if (!el || !state) return;
    el.style.removeProperty("transition");
    const velocity = state.dy / Math.max(Date.now() - state.time, 1);
    if (state.dy > DISMISS_DISTANCE || (state.dy > 24 && velocity > DISMISS_VELOCITY)) {
      // The closing animation starts from where the finger left the sheet.
      el.style.setProperty("--sheet-drag", `${state.dy}px`);
      el.style.transform = "";
      closeRef.current?.click();
    } else {
      el.style.transform = "";
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="sheet-overlay" />
        <DialogPrimitive.Content
          ref={contentRef}
          className={cn("sheet", className)}
          // Focusing the first field would pop up the keyboard on phones.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            contentRef.current?.focus();
          }}
        >
          <div
            className="sheet-header"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <span className="sheet-grabber" aria-hidden />
            <div className="sheet-heading">
              <DialogPrimitive.Title className="sheet-title">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="sheet-description">{description}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
              )}
            </div>
            {headerAction}
            <DialogPrimitive.Close ref={closeRef} className="sheet-icon-btn" aria-label={es ? "Cerrar" : "Close"}>
              <XIcon className="size-[18px]" strokeWidth={2.25} />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Scrollable content of a sheet. */
export function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("sheet-body", className)} {...props} />;
}

/** Actions pinned to the bottom of a sheet. */
export function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("sheet-footer", className)} {...props} />;
}

/** Form filling a sheet, so its footer buttons can submit it. */
export function SheetForm({ className, ...props }: React.ComponentProps<"form">) {
  return <form className={cn("sheet-form", className)} noValidate {...props} />;
}
