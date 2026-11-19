"use client";

import type { CSSProperties } from "react";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { formatCurrency } from "@/lib/format";

/** Typographic minus: the same width as "+", unlike the hyphen. */
export const MINUS = "−";

/** "+1.234,56 €" / "−12,00 €" / "0,00 €" (no sign for zero). */
export function signedText(n: number) {
  if (n === 0) return formatCurrency(0);
  return `${n > 0 ? "+" : MINUS}${formatCurrency(Math.abs(n))}`;
}

/**
 * Digits that roll to their new value like an odometer when `text` changes (units first, then
 * tens…). Each digit keeps its real glyph (transparent, so copying and screen readers get the
 * plain text) and shows a 0–9 strip drawn by CSS on top. A change in shape (more or fewer digits)
 * just shows the new text.
 */
function Rolling({ text, offset }: { text: string; offset: number }) {
  const chars = [...text];
  return (
    <span className="odo" key={text.replace(/\d/g, "0")}>
      {chars.map((c, k) =>
        /\d/.test(c) ? (
          <span key={k} className="odo-d" style={{ "--d": c, "--k": offset + chars.length - k } as CSSProperties}>
            <span className="odo-g">{c}</span>
          </span>
        ) : (
          <span key={k}>{c}</span>
        ),
      )}
    </span>
  );
}

/**
 * An amount in euros with the cents smaller and dimmed, so the whole part reads first.
 * `roll` makes its digits roll when the value changes (for summaries that change with the month).
 */
export function AmountText({ value, signed, roll }: { value: number; signed?: boolean; roll?: boolean }) {
  const text = signed ? signedText(value) : `${value < 0 ? MINUS : ""}${formatCurrency(Math.abs(value))}`;
  const comma = text.lastIndexOf(",");
  const whole = comma < 0 ? text : text.slice(0, comma);
  const cents = comma < 0 ? "" : text.slice(comma);
  if (!roll) {
    return (
      <span className="amount">
        {whole}
        {cents && <span className="amount-cents">{cents}</span>}
      </span>
    );
  }
  return (
    <span className="amount">
      <Rolling text={whole} offset={cents.length} />
      {cents && (
        <span className="amount-cents">
          <Rolling text={cents} offset={0} />
        </span>
      )}
    </span>
  );
}

/** `AmountText` that blurs in privacy mode (tap to reveal). */
export function Money({ value, signed, roll, className, applyGradient }: {
  value: number;
  /** "+" for positive and "−" for negative; zero has no sign. */
  signed?: boolean;
  roll?: boolean;
  className?: string;
  applyGradient?: boolean;
}) {
  return (
    <SensitiveAmount className={className} applyGradient={applyGradient}>
      <AmountText value={value} signed={signed} roll={roll} />
    </SensitiveAmount>
  );
}
