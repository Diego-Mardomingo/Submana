"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { motion, useAnimate, useMotionValue, usePresence, useReducedMotion } from "framer-motion";
import { useLang } from "@/hooks/useLang";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { cn } from "@/lib/utils";
import styles from "./NotificationBell.module.css";

/** Quiet tap of the bell while something is pending and the tab is visible. */
const IDLE_MS = 15_000;
/** The entry waits for the page's own fade-in (0.3 s). Only the first bell of the app load waits. */
const ENTRY_DELAY = 0.4;

/**
 * What the bells of this app load share. `visible`: a bell is on screen, so a bell mounted by a page
 * change just shows up without replaying the entry. `entered`: the first entry already played.
 */
const session = { visible: false, entered: false };

/** No bell is pending any more: the next one that appears plays its entry again. */
export const resetBellSession = () => {
  session.visible = false;
};

const display = (count: number) => (count > 9 ? "9+" : String(count));

/** Motion values of one sound wave next to the bell. */
function useWave() {
  return { opacity: useMotionValue(0), scale: useMotionValue(0.8), x: useMotionValue(0) };
}

/**
 * Variant A · Campanada: the lucide Bell split into body and clapper that swing from the handle, with two
 * sound waves. Entry (drop with a bounce), ring (new notification), idle tap and exit follow docs/design/bell.html.
 * Render it inside `AnimatePresence`: the exit plays while it is being removed. Reduced motion: fades only.
 */
export function BellButton({ count, small, onClick }: { count: number; small?: boolean; onClick: () => void }) {
  const t = useTranslations(useLang());
  const reduced = useReducedMotion() ?? false;
  const [scope, animate] = useAnimate();
  const [isPresent, safeToRemove] = usePresence();
  // A bell that appears while another one was already showing (page change) does not replay the entry.
  const [fresh] = useState(() => !session.visible);
  const drops = fresh && !reduced;

  const y = useMotionValue(drops ? -24 : 0);
  const scale = useMotionValue(drops ? 0.6 : 1);
  const opacity = useMotionValue(fresh ? 0 : 1);
  const rotate = useMotionValue(0);
  const body = useMotionValue(0);
  const clapper = useMotionValue(0);
  const badgeScale = useMotionValue(drops ? 0 : 1);
  const waveLeft = useWave();
  const waveRight = useWave();
  const lastAnimation = useRef(0);
  const previousCount = useRef(count);

  const rollNumber = () => {
    if (reduced) {
      animate("[data-bell-num]", { opacity: [0, 1] }, { duration: 0.18 });
      return;
    }
    animate("[data-bell-num]", { y: ["90%", "0%"], opacity: [0, 1] }, { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] });
    animate(badgeScale, [1, 1.3, 1], { duration: 0.32, ease: "easeOut" });
  };

  /** The main ring. `bump`: a new notification arrived, so the number rolls too. */
  const ring = useEffectEvent((bump: boolean, delay = 0, pulse = true) => {
    lastAnimation.current = performance.now();
    if (bump) rollNumber();
    if (reduced) return;
    const swing = { duration: 0.9, times: [0, 0.12, 0.3, 0.48, 0.66, 0.82, 1], ease: "easeInOut" as const };
    animate(body, [0, 16, -12, 8, -4, 1.5, 0], { ...swing, delay });
    animate(clapper, [0, -6, 20, -15, 9, -3, 0], { ...swing, delay: delay + 0.07 });
    [waveLeft, waveRight].forEach((wave, index) => {
      const wavy = { duration: 0.65, times: [0, 0.35, 1], ease: "easeOut" as const, delay: delay + 0.09 + index * 0.06 };
      animate(wave.opacity, [0, 1, 0], wavy);
      animate(wave.scale, [0.8, 1, 1.15], wavy);
      animate(wave.x, [0, 0, index ? 1.5 : -1.5], wavy);
    });
    if (pulse) animate(scale, [1, 1.07, 1], { duration: 0.32, ease: "easeOut", delay });
  });

  const idle = useEffectEvent(() => {
    lastAnimation.current = performance.now();
    if (reduced) return;
    animate(body, [0, 9, -7, 4, 0], { duration: 0.65, ease: "easeInOut" });
    animate(clapper, [0, -4, 11, -6, 0], { duration: 0.65, ease: "easeInOut", delay: 0.06 });
  });

  const enter = useEffectEvent((delay: number) => {
    lastAnimation.current = performance.now();
    if (reduced) {
      animate(opacity, [0, 1], { duration: 0.2, delay });
      return;
    }
    const drop = { duration: 0.52, times: [0, 0.6, 0.8, 1], ease: [0.3, 0.7, 0.4, 1] as [number, number, number, number], delay };
    animate(y, [-24, 3, -1, 0], drop);
    animate(scale, [0.6, 1.04, 0.99, 1], drop);
    animate(opacity, [0, 1, 1, 1], drop);
    // The badge pops right after the first stroke of the bell.
    animate(badgeScale, [0, 1.35, 0.9, 1.05, 1], { duration: 0.52, times: [0, 0.45, 0.7, 0.85, 1], ease: "easeOut", delay: delay + 0.53 });
    ring(false, delay + 0.38, false);
  });

  const leave = useEffectEvent(async () => {
    resetBellSession();
    if (reduced) await animate(opacity, 0, { duration: 0.2 });
    else await Promise.all([animate(scale, 0.6, { duration: 0.24, ease: "easeIn" }), animate(rotate, -12, { duration: 0.24, ease: "easeIn" }), animate(opacity, 0, { duration: 0.24, ease: "easeIn" })]);
    safeToRemove?.();
  });

  useEffect(() => {
    session.visible = true;
    lastAnimation.current = performance.now();
    if (!fresh) return;
    const delay = session.entered ? 0 : ENTRY_DELAY;
    session.entered = true;
    enter(delay);
  }, [fresh]);

  // A new notification while the bell is showing: ring and roll the number.
  useEffect(() => {
    const previous = previousCount.current;
    previousCount.current = count;
    if (isPresent && count > previous) ring(true);
  }, [count, isPresent]);

  useEffect(() => {
    if (!isPresent) void leave();
  }, [isPresent]);

  // Idle: a quiet tap every ~15 s, only with the tab visible. Never a continuous loop.
  useEffect(() => {
    if (!isPresent) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && performance.now() - lastAnimation.current >= IDLE_MS) idle();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isPresent]);

  const label = count === 1 ? t("bell.label.one") : interpolate(t("bell.label.other"), { count });
  const origin = { transformBox: "view-box" } as const;

  return (
    <motion.button ref={scope} type="button" className={cn(styles.bell, small && styles.sm)} style={{ y, scale, rotate, opacity }} aria-label={label} onClick={onClick}>
      <span className={styles.glow} aria-hidden />
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden>
        <motion.path className={styles.wave} d="M4 2C2.8 3.7 2 5.7 2 8" style={{ ...origin, transformOrigin: "12px 8px", ...waveLeft }} />
        <motion.path className={styles.wave} d="M22 8c0-2.3-.8-4.3-2-6" style={{ ...origin, transformOrigin: "12px 8px", ...waveRight }} />
        <motion.g style={{ ...origin, transformOrigin: "12px 2.6px", rotate: body }}>
          <path d="M6 8a6 6 0 0 1 12 0c0 4.499 1.411 5.956 2.738 7.326A1 1 0 0 1 20 17H4a1 1 0 0 1-.738-1.674C4.589 13.956 6 12.499 6 8" />
        </motion.g>
        <motion.g style={{ ...origin, transformOrigin: "12px 2.6px", rotate: clapper }}>
          <path d="M10.268 21a2 2 0 0 0 3.464 0" />
        </motion.g>
      </svg>
      <motion.span className={styles.badge} style={{ scale: badgeScale }} aria-hidden>
        <span data-bell-num className={styles.num}>
          {display(count)}
        </span>
      </motion.span>
    </motion.button>
  );
}
