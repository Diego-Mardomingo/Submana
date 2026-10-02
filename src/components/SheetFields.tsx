"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus, Trash2 } from "lucide-react";
import { PALETTE } from "@/lib/palette";
import { Spinner } from "@/components/ui/spinner";
import { normalizeCurrencyInput, sanitizeCurrencyInput } from "@/lib/currency";
import { useLang } from "@/hooks/useLang";
import { cn } from "@/lib/utils";

/* Building blocks for the create/edit sheets: grouped "settings style" cards, a large amount
   field, chips, segmented controls… Styles live in sheet.css (`sf-` prefix). */

/** Centred top block of a form: preview icon, big amount, status… */
export function FormHero({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("sf-hero", className)} {...props} />;
}

/** Large tile showing the item's logo, emoji or icon. */
export function HeroTile({ color, contain, className, children, ...props }: React.ComponentProps<"div"> & { color?: string; contain?: boolean }) {
  return (
    <div
      className={cn("sf-tile", contain && "sf-tile--contain", className)}
      style={color ? ({ "--tile-color": color } as React.CSSProperties) : undefined}
      {...props}
    >
      {children}
    </div>
  );
}

/** Big centred euro amount: the main value of the form. */
export function AmountField({ id, label, value, onChange, tone, invalid, autoFocus }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  tone?: "income" | "expense" | "accent";
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const width = Math.max(value.length, 4);
  return (
    <div className={cn("sf-amount", tone && `sf-amount--${tone}`, invalid && "is-invalid")}>
      <label htmlFor={id} className="sf-amount-label">
        {label}
      </label>
      <div className="sf-amount-input">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          value={value}
          autoFocus={autoFocus}
          aria-invalid={invalid || undefined}
          style={{ width: `${width + 0.5}ch` }}
          onChange={(e) => {
            const next = sanitizeCurrencyInput(e.target.value);
            if (next !== null) onChange(next);
          }}
          onBlur={() => onChange(normalizeCurrencyInput(value))}
          onFocus={(e) => e.currentTarget.select()}
        />
        <span aria-hidden>€</span>
      </div>
    </div>
  );
}

/** Card grouping related fields, with an optional caption above and hint below. */
export function FieldGroup({ title, hint, className, children }: { title?: React.ReactNode; hint?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("sf-section", className)}>
      {title && <h3 className="sf-section-title">{title}</h3>}
      <div className="sf-group">{children}</div>
      {hint && <p className="sf-hint">{hint}</p>}
    </section>
  );
}

/** Label on the left, control on the right (one line). */
export function FieldRow({ label, htmlFor, children, className }: { label: React.ReactNode; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("sf-row", className)}>
      <label htmlFor={htmlFor} className="sf-row-label">
        {label}
      </label>
      <div className="sf-row-control">{children}</div>
    </div>
  );
}

/** Label above a full-width control (chips, swatches, search…). */
export function FieldStack({ label, aside, children, className }: { label?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("sf-stack", className)}>
      {(label || aside) && (
        <div className="sf-stack-head">
          <span className="sf-row-label">{label}</span>
          {aside}
        </div>
      )}
      {children}
    </div>
  );
}

/** Borderless text input for use inside a `FieldRow`. */
export function RowInput({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn("sf-input", className)} autoComplete="off" {...props} />;
}

/** Two or three mutually exclusive options. */
export function Segmented<T extends string>({ value, onChange, options, className, label }: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: React.ReactNode; tone?: "income" | "expense" | "warn" }[];
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn("sf-segmented", className)} role="radiogroup" aria-label={label} style={{ "--count": options.length } as React.CSSProperties}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={cn("sf-segment", option.tone && `sf-segment--${option.tone}`)}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export type ChipOption = { value: string; label: React.ReactNode; icon?: React.ReactNode; color?: string };

/** Tappable chips; single choice unless `multiple`. `scroll` keeps them on one swipeable line. */
export function Chips({ options, value, onChange, multiple, scroll, label }: {
  options: ChipOption[];
  label?: string;
} & (
  | { multiple?: false; value: string; onChange: (value: string) => void }
  | { multiple: true; value: string[]; onChange: (value: string[]) => void }
) & { scroll?: boolean }) {
  const selected = (v: string) => (multiple ? value.includes(v) : value === v);
  const toggle = (v: string) => {
    if (multiple) onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
    else onChange(v);
  };
  return (
    <div className={cn("sf-chips", scroll && "sf-chips--scroll")} role={multiple ? "group" : "radiogroup"} aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role={multiple ? "checkbox" : "radio"}
          aria-checked={selected(option.value)}
          className="sf-chip"
          style={option.color ? ({ "--chip-color": option.color } as React.CSSProperties) : undefined}
          onClick={() => toggle(option.value)}
        >
          {option.icon}
          <span className="sf-chip-label">{option.label}</span>
          {multiple && selected(option.value) && <Check className="sf-chip-check" strokeWidth={3} aria-hidden />}
        </button>
      ))}
    </div>
  );
}

/** Inline palette (accounts, budgets). */
export function Swatches({ value, onChange, label }: { value: string; onChange: (color: string) => void; label?: string }) {
  return (
    <div className="sf-swatches" role="radiogroup" aria-label={label}>
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          className="sf-swatch"
          style={{ "--swatch": color } as React.CSSProperties}
          onClick={() => onChange(color)}
        >
          {value === color && <Check strokeWidth={3} aria-hidden />}
        </button>
      ))}
    </div>
  );
}

/** − n + counter. */
export function Stepper({ value, onChange, min = 1, max = 99, label }: { value: number; onChange: (value: number) => void; min?: number; max?: number; label?: string }) {
  return (
    <div className="sf-stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="−1">
        <Minus strokeWidth={2.5} />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="+1">
        <Plus strokeWidth={2.5} />
      </button>
    </div>
  );
}

/** Read-only label / value line for detail views. */
export function InfoRow({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("sf-row sf-row--info", className)}>
      <span className="sf-row-label">{label}</span>
      <span className="sf-row-value">{children}</span>
    </div>
  );
}

/** Full-width action line inside a `FieldGroup` (e.g. "Cancel subscription"). */
export function ActionRow({ icon, tone, className, children, ...props }: React.ComponentProps<"button"> & { icon?: React.ReactNode; tone?: "danger" | "warn" | "accent" }) {
  return (
    <button type="button" className={cn("sf-row sf-action", tone && `sf-action--${tone}`, className)} {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

/**
 * Destructive action that asks for confirmation in place: the row turns into a short warning
 * with cancel / confirm buttons instead of stacking another dialog over the sheet.
 */
export function DeleteAction({ label, confirmTitle, confirmText, confirmLabel, onConfirm, pending, tone = "danger", icon }: {
  label: string;
  confirmTitle: string;
  confirmText?: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  pending?: boolean;
  tone?: "danger" | "warn";
  icon?: React.ReactNode;
}) {
  const es = useLang() === "es";
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (confirming) confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [confirming]);
  if (!confirming) {
    return (
      <ActionRow tone={tone} icon={icon ?? <Trash2 aria-hidden />} onClick={() => setConfirming(true)}>
        {label}
      </ActionRow>
    );
  }
  return (
    <div ref={confirmRef} className={cn("sf-confirm", `sf-confirm--${tone}`)} role="alert">
      <p className="sf-confirm-title">{confirmTitle}</p>
      {confirmText && <div className="sf-confirm-text">{confirmText}</div>}
      <div className="sf-confirm-actions">
        <button type="button" className="sf-btn sf-btn--ghost" onClick={() => setConfirming(false)} disabled={pending}>
          {es ? "No, volver" : "No, go back"}
        </button>
        <button type="button" className={cn("sf-btn", tone === "warn" ? "sf-btn--warn" : "sf-btn--danger")} onClick={onConfirm} disabled={pending}>
          {pending && <Spinner className="size-4" />}
          {confirmLabel ?? label}
        </button>
      </div>
    </div>
  );
}

/** Footer buttons. */
export function SheetButton({ variant = "primary", pending, className, children, ...props }: React.ComponentProps<"button"> & {
  variant?: "primary" | "ghost" | "danger" | "warn";
  pending?: boolean;
}) {
  return (
    <button className={cn("sf-btn", `sf-btn--${variant}`, className)} disabled={pending || props.disabled} {...props}>
      {pending && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

/** Error message shown above the footer. */
export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="sf-error" role="alert">
      {children}
    </p>
  );
}
