"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const THRESHOLD = 20;
const VELOCITY_THRESHOLD = 0.25;
const HORIZONTAL_LOCK_THRESHOLD = 10;

type Options = {
  onOpen?: () => void;
  onClose?: () => void;
};

export function useSwipeToReveal(actionsWidth: number, options?: Options) {
  const { onOpen, onClose } = options ?? {};
  const containerRef = useRef<HTMLDivElement>(null);
  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const startRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastXRef = useRef<number>(0);
  const translateRef = useRef(0);
  const horizontalLockRef = useRef<boolean | null>(null);

  const actionsWidthRef = useRef(actionsWidth);
  actionsWidthRef.current = actionsWidth;
  translateRef.current = translateX;

  const open = useCallback(() => {
    const w = actionsWidthRef.current;
    setIsAnimating(true);
    translateRef.current = -w;
    setTranslateX(-w);
    onOpen?.();
  }, [onOpen]);

  const close = useCallback(() => {
    setIsAnimating(true);
    translateRef.current = 0;
    setTranslateX(0);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      startRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      lastXRef.current = touch.clientX;
      horizontalLockRef.current = null;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!startRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startRef.current.x;
      const deltaY = touch.clientY - startRef.current.y;

      if (horizontalLockRef.current === null) {
        if (Math.abs(deltaX) > HORIZONTAL_LOCK_THRESHOLD || Math.abs(deltaY) > HORIZONTAL_LOCK_THRESHOLD) {
          horizontalLockRef.current = Math.abs(deltaX) >= Math.abs(deltaY);
        }
      }

      if (horizontalLockRef.current === false) return;

      if (horizontalLockRef.current === true) {
        e.preventDefault();
      }

      const w = actionsWidthRef.current;
      const newTranslate = Math.max(
        -w,
        Math.min(0, translateRef.current + (touch.clientX - lastXRef.current))
      );
      lastXRef.current = touch.clientX;
      translateRef.current = newTranslate;
      setTranslateX(newTranslate);
    };

    const handleTouchEnd = () => {
      const currentTx = translateRef.current;
      if (!startRef.current) return;

      const elapsed = Date.now() - startRef.current.time;
      const velocity = Math.abs(currentTx) / Math.max(elapsed, 1);

      if (currentTx < -THRESHOLD || velocity > VELOCITY_THRESHOLD) {
        open();
      } else {
        close();
      }
      startRef.current = null;
      horizontalLockRef.current = null;
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    el.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [open, close]);

  return {
    translateX,
    isAnimating,
    containerRef,
    onTransitionEnd: useCallback(() => setIsAnimating(false), []),
    open,
    close,
    setTranslateX,
  };
}
