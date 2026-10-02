"use client";

import { createContext, useContext, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { createClientStore } from "@/lib/clientStore";
import { cn } from "@/lib/utils";

const OPEN_THRESHOLD = 20;
const VELOCITY_THRESHOLD = 0.25;
const DIRECTION_LOCK_THRESHOLD = 10;

const SWIPE_LEARNED_KEY = "submana-swipe-learned";

// Once the user has opened a row by swiping, swipe hints (peek animation, help text) stop showing.
// Server value is `true` so hints never flash during hydration.
const swipeLearnedStore = createClientStore(
  () => {
    try {
      return localStorage.getItem(SWIPE_LEARNED_KEY) === "true";
    } catch {
      return false;
    }
  },
  (learned: boolean) => {
    try {
      localStorage.setItem(SWIPE_LEARNED_KEY, String(learned));
    } catch {}
  },
  true
);

export const useSwipeLearned = swipeLearnedStore.useValue;

const SwipeGroupContext = createContext<{ openId: string | null; setOpenId: (id: string | null) => void } | null>(null);

/** Keeps at most one row of the group open and closes it when tapping elsewhere. */
export function SwipeToRevealGroup({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openId === null) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const openRow = containerRef.current?.querySelector(`[data-swipe-id="${openId}"]`);
      if (openRow && !openRow.contains(e.target as Node)) setOpenId(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [openId]);

  return (
    <SwipeGroupContext.Provider value={{ openId, setOpenId }}>
      <div ref={containerRef} className={className} style={style}>
        {children}
      </div>
    </SwipeGroupContext.Provider>
  );
}

/**
 * Row whose `actions` are revealed by swiping left on touch layouts; from `desktopMinWidth`
 * up the actions are always visible next to the content.
 */
export function SwipeToReveal({ id, children, actions, swipeHint, peek, desktopMinWidth = 641, className, contentClassName }: {
  id?: string;
  children: React.ReactNode;
  actions: React.ReactNode;
  swipeHint?: boolean;
  /** Briefly slides the row open on mount to show that it can be swiped, until the user has swiped once. */
  peek?: boolean;
  desktopMinWidth?: number;
  className?: string;
  contentClassName?: string;
}) {
  const isDesktop = useMediaQuery(`(min-width: ${desktopMinWidth}px)`);
  const group = useContext(SwipeGroupContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [actionsWidth, setActionsWidth] = useState(88);
  const [localOpen, setLocalOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const learned = useSwipeLearned();
  const [peekDone, setPeekDone] = useState(false);
  const peeking = !!peek && !learned && !peekDone;
  // Inside a group the open row is the group's; another row opening closes this one.
  const isOpen = group && id ? group.openId === id : localOpen;
  const translateX = dragOffset ?? (isOpen ? -actionsWidth : 0);

  useLayoutEffect(() => {
    const el = actionsRef.current;
    if (!el) return;
    const measure = () => el.offsetWidth > 0 && setActionsWidth(el.offsetWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [actions]);

  const restingOffset = useEffectEvent(() => (isOpen ? -actionsWidth : 0));
  const maxOffset = useEffectEvent(() => actionsWidth);
  const settle = useEffectEvent((open: boolean) => {
    setDragOffset(null);
    if (open && !learned) swipeLearnedStore.set(true);
    if (!group || !id) setLocalOpen(open);
    else if (open) group.setOpenId(id);
    else if (isOpen) group.setOpenId(null);
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let start: { x: number; y: number; time: number } | null = null;
    let lastX = 0;
    let horizontal: boolean | null = null;
    let offset = 0;

    const onStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      start = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      lastX = touch.clientX;
      horizontal = null;
      offset = restingOffset();
      setPeekDone(true);
    };
    const onMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (horizontal === null && (Math.abs(dx) > DIRECTION_LOCK_THRESHOLD || Math.abs(dy) > DIRECTION_LOCK_THRESHOLD)) {
        horizontal = Math.abs(dx) >= Math.abs(dy);
      }
      if (horizontal === false) return;
      if (horizontal) e.preventDefault();
      offset = Math.max(-maxOffset(), Math.min(0, offset + touch.clientX - lastX));
      lastX = touch.clientX;
      setDragOffset(offset);
    };
    const onEnd = () => {
      if (!start) return;
      const velocity = Math.abs(offset) / Math.max(Date.now() - start.time, 1);
      settle(offset < -OPEN_THRESHOLD || velocity > VELOCITY_THRESHOLD);
      start = null;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [isDesktop]);

  if (isDesktop) {
    return (
      <div className={cn("swipe-to-reveal swipe-to-reveal--desktop", className)} data-swipe-id={id}>
        <div className={cn("swipe-to-reveal__track", contentClassName)} style={{ transform: "none" }}>
          <div className="swipe-to-reveal__content flex-1 min-w-0">{children}</div>
          <div ref={actionsRef} className="swipe-to-reveal__actions swipe-to-reveal__actions--measure">
            {actions}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("swipe-to-reveal", peeking && "swipe-to-reveal--peek", className)} data-swipe-id={id} style={{ "--actions-width": `${actionsWidth}px` } as React.CSSProperties}>
      <div
        className={cn("swipe-to-reveal__track", contentClassName)}
        onAnimationEnd={() => setPeekDone(true)}
        style={{ transform: `translateX(${translateX}px)`, width: `calc(100% + ${actionsWidth}px)`, minWidth: `calc(100% + ${actionsWidth}px)` }}
      >
        <div className={cn("swipe-to-reveal__content flex-1 min-w-0", swipeHint && "relative")}>
          {children}
          {swipeHint && (
            <span className="swipe-hint-icon" aria-hidden>
              <GripVertical className="size-4 opacity-50" />
            </span>
          )}
        </div>
        <div ref={actionsRef} className="swipe-to-reveal__actions" style={{ width: "max-content", minWidth: actionsWidth, flexShrink: 0 }}>
          {actions}
        </div>
      </div>
    </div>
  );
}
