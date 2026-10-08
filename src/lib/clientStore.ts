import { useSyncExternalStore } from "react";

/** Browser-persisted value shared by every component; renders `serverValue` during SSR/hydration. */
export function createClientStore<T>(read: () => T, write: (value: T) => void, serverValue: T) {
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return {
    /** Current value, for code outside React (callbacks, the query cache). */
    get: read,
    useValue: () => useSyncExternalStore(subscribe, read, () => serverValue),
    set(value: T) {
      write(value);
      listeners.forEach((listener) => listener());
    },
  };
}
