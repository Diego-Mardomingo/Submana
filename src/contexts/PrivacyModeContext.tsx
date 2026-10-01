"use client";

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";

const STORAGE_KEY = "submana-privacy-mode";

function getPrivacyModeFromStorage(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

const listeners = new Set<() => void>();
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Sincroniza también entre pestañas.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

type PrivacyModeContextValue = {
  privacyModeEnabled: boolean;
  setPrivacyModeEnabled: (enabled: boolean) => void;
};

const PrivacyModeContext = createContext<PrivacyModeContextValue | null>(null);

export function PrivacyModeProvider({ children }: { children: React.ReactNode }) {
  const privacyModeEnabled = useSyncExternalStore(subscribe, getPrivacyModeFromStorage, () => false);

  const setPrivacyModeEnabled = useCallback((enabled: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // Almacenamiento no disponible (modo privado): no persiste.
    }
    listeners.forEach((listener) => listener());
  }, []);

  const value = useMemo(
    () => ({ privacyModeEnabled, setPrivacyModeEnabled }),
    [privacyModeEnabled, setPrivacyModeEnabled]
  );

  return (
    <PrivacyModeContext.Provider value={value}>
      {children}
    </PrivacyModeContext.Provider>
  );
}

export function usePrivacyMode() {
  const ctx = useContext(PrivacyModeContext);
  if (!ctx) {
    throw new Error("usePrivacyMode must be used within PrivacyModeProvider");
  }
  return ctx;
}
