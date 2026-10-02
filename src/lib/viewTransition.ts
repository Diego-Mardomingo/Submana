import { flushSync } from "react-dom";

/**
 * Runs a React state update inside a View Transition (when supported), tagging <html> with
 * `attribute=value` for the duration so CSS can pick the animation.
 */
export function withViewTransition(update: () => void, attribute: string, value = "true") {
  if (typeof document === "undefined" || typeof document.startViewTransition !== "function") return update();
  const root = document.documentElement;
  root.setAttribute(attribute, value);
  document.startViewTransition(() => flushSync(update)).finished.finally(() => root.removeAttribute(attribute));
}
