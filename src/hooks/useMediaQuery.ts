"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** False during SSR and hydration, true afterwards (for values that differ between server and client). */
export function useMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
