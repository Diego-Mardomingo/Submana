/**
 * Minimal types for Navigation API (intercepting back/forward).
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API
 */
interface NavigationDestination {
  url: string;
}

interface NavigateEvent extends Event {
  readonly navigationType: "push" | "reload" | "replace" | "traverse";
  readonly canIntercept: boolean;
  readonly destination: NavigationDestination;
  intercept(options?: { handler?: () => void | Promise<void> }): void;
}

interface Navigation extends EventTarget {
  addEventListener(
    type: "navigate",
    listener: (event: NavigateEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener(
    type: "navigate",
    listener: (event: NavigateEvent) => void,
    options?: boolean | EventListenerOptions
  ): void;
}

declare global {
  interface Window {
    navigation?: Navigation;
  }
}

export type { NavigateEvent, Navigation };
