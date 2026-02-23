"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useSwipeToReveal } from "@/hooks/useSwipeToReveal";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

const DEFAULT_ACTIONS_WIDTH = 88;

type SwipeToRevealGroupContextValue = {
  openId: string | null;
  setOpenId: (id: string | null) => void;
};

const SwipeToRevealGroupContext = createContext<SwipeToRevealGroupContextValue | null>(null);

export function SwipeToRevealGroup({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [openId, setOpenIdState] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const setOpenId = useCallback((id: string | null) => setOpenIdState(id), []);

  useEffect(() => {
    if (openId === null) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      const openCard = containerRef.current?.querySelector(`[data-swipe-id="${openId}"]`);
      if (openCard && !openCard.contains(target)) {
        setOpenIdState(null);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [openId]);

  return (
    <SwipeToRevealGroupContext.Provider value={{ openId, setOpenId }}>
      <div ref={containerRef} className={className} style={style}>{children}</div>
    </SwipeToRevealGroupContext.Provider>
  );
}

export function SwipeToReveal({
  id,
  children,
  actions,
  swipeHint,
  desktopMinWidth = 641,
  className,
  contentClassName,
  actionsClassName,
}: {
  id?: string;
  children: React.ReactNode;
  actions: React.ReactNode;
  swipeHint?: boolean;
  /** Ancho mínimo (px) para mostrar iconos dentro de la tarjeta en vez de swipe. Ej: 1024 para solo pantallas grandes. */
  desktopMinWidth?: number;
  className?: string;
  contentClassName?: string;
  actionsClassName?: string;
}) {
  const isDesktopLayout = useMediaQuery(`(min-width: ${desktopMinWidth}px)`);
  const group = useContext(SwipeToRevealGroupContext);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [actionsWidth, setActionsWidth] = useState(DEFAULT_ACTIONS_WIDTH);

  const close = useCallback(() => {
    if (group && id && group.openId === id) group.setOpenId(null);
  }, [group, id]);

  const { translateX, containerRef, onTransitionEnd, close: doClose } = useSwipeToReveal(
    actionsWidth,
    {
      onOpen: () => group && id && group.setOpenId(id),
      onClose: close,
    }
  );

  useLayoutEffect(() => {
    const el = actionsRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.offsetWidth;
      if (w > 0) setActionsWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [actions]);

  useEffect(() => {
    if (group && id && group.openId !== id) {
      doClose();
    }
  }, [group?.openId, id, doClose]);

  if (isDesktopLayout) {
    return (
      <div className={cn("swipe-to-reveal swipe-to-reveal--desktop", className)} data-swipe-id={id}>
        <div className={cn("swipe-to-reveal__track", contentClassName)} style={{ transform: "none" }}>
          <div className={cn("swipe-to-reveal__content", "flex-1 min-w-0")}>{children}</div>
          <div ref={actionsRef} className={cn("swipe-to-reveal__actions swipe-to-reveal__actions--measure", actionsClassName)}>
            {actions}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("swipe-to-reveal", className)}
      data-swipe-id={id}
      onTransitionEnd={onTransitionEnd}
      style={{ "--actions-width": `${actionsWidth}px` } as React.CSSProperties}
    >
      <div
        className={cn("swipe-to-reveal__track", contentClassName)}
        style={{ transform: `translateX(${translateX}px)`, width: `calc(100% + ${actionsWidth}px)`, minWidth: `calc(100% + ${actionsWidth}px)` }}
      >
        <div className={cn("swipe-to-reveal__content", "flex-1 min-w-0", swipeHint && "relative")}>
          {children}
          {swipeHint && (
            <span className="swipe-hint-icon" aria-hidden>
              <GripVertical className="size-4 opacity-50" />
            </span>
          )}
        </div>
        <div
          ref={actionsRef}
          className={cn("swipe-to-reveal__actions", actionsClassName)}
          style={{ width: "max-content", minWidth: actionsWidth, flexShrink: 0 }}
        >
          {actions}
        </div>
      </div>
    </div>
  );
}
