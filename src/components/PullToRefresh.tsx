"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LOGO_FACETS } from "@/components/icons";
import { useLang } from "@/hooks/useLang";
import { haptic } from "@/lib/haptics";
import { useTranslations } from "@/lib/i18n/utils";

/** Pull distance (px, after resistance) that arms the refresh, where the page waits while it runs, and its limit. */
const ARM = 78;
const HOLD = 64;
const MAX = 120;
/** At least this long spinning, so a fast refetch still reads as "it did something". */
const MIN_SPIN_MS = 700;
const DONE_MS = 650;
/** The indicator starts fading this long before the page goes back up, so its label is gone before the content reaches it. */
const FADE_LEAD_MS = 100;

type Phase = "idle" | "pull" | "refreshing" | "done" | "error";

/** Finger distance → page offset: follows the finger at first and gets harder, like iOS's bounce. */
const resist = (dy: number) => MAX * 1.25 * (1 - Math.exp(-dy / (MAX * 1.4)));

/** Something else owns the gesture: an open sheet or menu, or an element that scrolls or swipes on its own. */
function blocked(target: EventTarget | null) {
  if (document.querySelector('[role="dialog"], [data-radix-popper-content-wrapper]')) return true;
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
    if (el.matches("input, textarea, select, [contenteditable], [data-no-pull]")) return true;
    if (el.scrollTop > 0) return true;
  }
  return false;
}

/**
 * Pull down from the top of any page to refetch its data (not the bank: syncing it on demand is
 * in the account page, and the provider only allows a few syncs a day). Instead of a spinner the
 * Submana gem assembles facet by facet as you pull, clicks when it's armed and spins while the
 * queries refetch. Touch screens only.
 */
export function PullToRefresh() {
  const queryClient = useQueryClient();
  const t = useTranslations(useLang());
  const [phase, setPhase] = useState<Phase>("idle");
  const [offset, setOffset] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const phaseRef = useRef<Phase>("idle");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (!matchMedia("(pointer: coarse)").matches) return;
    const shell = document.querySelector<HTMLElement>(".auth-content-shell");
    if (!shell) return;
    let start: { x: number; y: number; target: EventTarget | null } | null = null;
    let pulling = false;
    let current = 0;
    let armed = false;

    const move = (y: number, animate: boolean) => {
      current = y;
      shell.style.transition = animate ? "transform 0.5s var(--ease-ios)" : "none";
      shell.style.transform = y ? `translateY(${y}px)` : "";
      setOffset(y);
    };
    const reset = () => {
      pulling = false;
      armed = false;
      start = null;
      move(0, true);
    };

    const onStart = (e: TouchEvent) => {
      if (phaseRef.current !== "idle" || e.touches.length !== 1 || window.scrollY > 0) return;
      const touch = e.touches[0];
      start = { x: touch.clientX, y: touch.clientY, target: e.target };
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const touch = e.touches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (!pulling) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) return void (start = null);
        if (dy < 0 || window.scrollY > 0) return void (start = null);
        if (dy < 8) return;
        if (blocked(start.target)) return void (start = null);
        pulling = true;
        setPhase("pull");
      }
      if (e.cancelable) e.preventDefault();
      const y = resist(Math.max(0, dy - 8));
      move(y, false);
      if (y >= ARM !== armed) {
        armed = y >= ARM;
        if (armed) haptic();
        setOffset(y);
      }
    };
    const onEnd = async () => {
      if (!pulling) return void (start = null);
      start = null;
      pulling = false;
      if (!armed) {
        setPhase("idle");
        return move(0, true);
      }
      armed = false;
      setPhase("refreshing");
      move(HOLD, true);
      const began = Date.now();
      let ok = true;
      try {
        await queryClient.refetchQueries({ type: "active" }, { throwOnError: true });
      } catch {
        ok = false;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, MIN_SPIN_MS - (Date.now() - began))));
      setPhase(ok ? "done" : "error");
      await new Promise((resolve) => setTimeout(resolve, DONE_MS));
      setLeaving(true);
      await new Promise((resolve) => setTimeout(resolve, FADE_LEAD_MS));
      move(0, true);
      setTimeout(() => {
        if (current === 0) {
          shell.style.transition = "";
          setPhase("idle");
          setLeaving(false);
        }
      }, 500);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", reset);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", reset);
      shell.style.transform = "";
      shell.style.transition = "";
    };
  }, [queryClient]);

  if (phase === "idle") return null;
  const progress = Math.min(1, offset / ARM);
  const lit = phase === "pull" ? Math.ceil(progress * LOGO_FACETS.length) : LOGO_FACETS.length;
  const armed = phase === "pull" && offset >= ARM;
  const label =
    phase === "refreshing" ? t("pull.refreshing") : phase === "done" ? t("pull.done") : phase === "error" ? t("pull.error") : armed ? t("pull.release") : t("pull.pull");
  return (
    <div
      className="ptr"
      data-phase={phase}
      data-armed={armed}
      data-leaving={leaving || undefined}
      style={{ opacity: leaving ? 0 : phase === "pull" ? Math.min(1, offset / 40) : 1 }}
      role="status"
      aria-live="polite"
    >
      <svg className="ptr-gem" viewBox="6 10 52 47" aria-hidden>
        <g style={{ stroke: "var(--negro)" }} strokeWidth={1.6} strokeLinejoin="round">
          {LOGO_FACETS.map(({ points, fill }, i) => (
            <polygon key={points} points={points} style={{ fill }} className={i < lit ? "is-on" : undefined} />
          ))}
        </g>
      </svg>
      <span className="ptr-text">{label}</span>
    </div>
  );
}
