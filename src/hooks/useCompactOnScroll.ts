"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * True while the user scrolls down a page (past `threshold` px), false again once they scroll back up by
 * `hysteresis` px or return near the top. The margin keeps it from flickering on small scrolls. A new `resetKey`
 * (the route) starts it expanded again; the returned setter forces it (e.g. expanded when opening the +).
 */
export function useCompactOnScroll({ threshold = 60, hysteresis = 8, enabled = true, resetKey }: { threshold?: number; hysteresis?: number; enabled?: boolean; resetKey?: unknown } = {}) {
  const [compact, setCompactState] = useState(false);
  const [key, setKey] = useState(resetKey);
  const current = useRef(false);
  const anchor = useRef(0);

  const setCompact = useCallback((next: boolean) => {
    current.current = next;
    anchor.current = window.scrollY;
    setCompactState(next);
  }, []);

  // Another route: expanded again (adjusted while rendering, not in an effect).
  if (key !== resetKey) {
    setKey(resetKey);
    setCompactState(false);
  }

  useEffect(() => {
    current.current = false;
    anchor.current = window.scrollY;
    if (!enabled) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      let next = current.current;
      if (y < threshold) next = false;
      else if (y > anchor.current + hysteresis) next = true;
      else if (y < anchor.current - hysteresis) next = false;
      if (next !== current.current) setCompact(next);
      // The anchor follows the scroll while it keeps going the same way, so turning back always takes the full margin.
      else if (next ? y > anchor.current : y < anchor.current) anchor.current = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [threshold, hysteresis, enabled, resetKey, setCompact]);

  return [enabled && compact, setCompact] as const;
}
