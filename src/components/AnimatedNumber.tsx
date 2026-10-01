"use client";

import { useEffect, useRef, useState } from "react";

/** Number that eases (cubic out) from its previous value to `value`. */
export function AnimatedNumber({ value, duration = 300, formatFn = (n) => n.toFixed(2) }: {
  value: number;
  duration?: number;
  formatFn?: (n: number) => string;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    const start = shownRef.current;
    if (start === value) return;
    const startTime = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      shownRef.current = start + (value - start) * (1 - Math.pow(1 - progress, 3));
      setDisplayValue(shownRef.current);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span>{formatFn(displayValue)}</span>;
}
