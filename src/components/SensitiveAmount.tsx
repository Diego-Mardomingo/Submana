"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { usePrivacyMode } from "@/contexts/PrivacyModeContext";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SensitiveAmountProps {
  children: React.ReactNode;
  className?: string;
  as?: "span" | "div";
  progressPosition?: "above" | "below";
  /** Aplica degradado morado/accent al texto (necesario para que blur funcione con gradient text) */
  applyGradient?: boolean;
}

const REVEAL_DURATION_MS = 3000;
const TAP_MOVEMENT_THRESHOLD_PX = 10;

export function SensitiveAmount({
  children,
  className,
  as: As = "span",
  progressPosition = "below",
  applyGradient = false,
}: SensitiveAmountProps) {
  const { privacyModeEnabled } = usePrivacyMode();
  const lang = useLang();
  const t = useTranslations(lang);
  const [revealing, setRevealing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startReveal = useCallback(() => {
    clearTimer();
    setRevealing(true);
    timerRef.current = setTimeout(() => {
      setRevealing(false);
      timerRef.current = null;
    }, REVEAL_DURATION_MS);
  }, [clearTimer]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!privacyModeEnabled || revealing) return;
      pointerDownRef.current = { x: e.clientX, y: e.clientY };
    },
    [privacyModeEnabled, revealing]
  );

  const endReveal = useCallback(() => {
    clearTimer();
    setRevealing(false);
  }, [clearTimer]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!privacyModeEnabled) return;
      if (revealing) {
        endReveal();
        return;
      }
      const start = pointerDownRef.current;
      if (start) {
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > TAP_MOVEMENT_THRESHOLD_PX) return;
      }
      pointerDownRef.current = null;
      startReveal();
    },
    [privacyModeEnabled, revealing, startReveal, endReveal]
  );

  useEffect(() => clearTimer, [clearTimer]);

  if (!privacyModeEnabled) {
    return (
      <As className={cn(className, applyGradient && "sensitive-amount-gradient")}>
        {children}
      </As>
    );
  }

  const content = (
    <As
      className={cn(
        "sensitive-amount-wrapper relative inline-flex flex-col overflow-visible mb-1",
        "cursor-pointer select-none",
        progressPosition === "above" && "flex-col-reverse",
        className
      )}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (revealing) endReveal();
          else startReveal();
        }
      }}
      aria-label={
        revealing
          ? t("settings.privacyModeRevealing")
          : t("settings.privacyModeHover")
      }
    >
      <span
        className={cn(
          "sensitive-amount-content transition-[filter] duration-150",
          !revealing && "sensitive-amount-blur",
          applyGradient && "sensitive-amount-gradient"
        )}
        data-revealed={revealing}
      >
        {children}
      </span>
      {revealing && (
        <span
          className={cn(
            "sensitive-amount-progress absolute left-0 right-0 h-0.5 min-w-[2rem] overflow-hidden rounded-full bg-muted",
            progressPosition === "below" ? "top-full mt-0.5" : "bottom-full mb-0.5"
          )}
          role="progressbar"
          aria-valuenow={REVEAL_DURATION_MS}
          aria-valuemin={0}
          aria-valuemax={REVEAL_DURATION_MS}
        >
          <span
            className="block h-full rounded-full bg-primary"
            style={{
              animation: `sensitive-amount-progress-shrink ${REVEAL_DURATION_MS}ms linear forwards`,
            }}
          />
        </span>
      )}
    </As>
  );

  if (!revealing) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent side="top">
          {t("settings.privacyModeHover")}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
