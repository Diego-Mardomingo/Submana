"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

const STORAGE_KEY = "submana-privacy-mode";

function getPrivacyModeFromStorage(): boolean {
  if (typeof document === "undefined") return false;
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "true";
}

type PrivacyModeContextValue = {
  privacyModeEnabled: boolean;
  setPrivacyModeEnabled: (enabled: boolean) => void;
};

const PrivacyModeContext = createContext<PrivacyModeContextValue | null>(null);

export function PrivacyModeProvider({ children }: { children: React.ReactNode }) {
  const [privacyModeEnabled, setPrivacyModeState] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPrivacyModeState(getPrivacyModeFromStorage());
    setMounted(true);
  }, []);

  const setPrivacyModeEnabled = useCallback((enabled: boolean) => {
    setPrivacyModeState(enabled);
    localStorage.setItem(STORAGE_KEY, String(enabled));
  }, []);

  const value = mounted
    ? { privacyModeEnabled, setPrivacyModeEnabled }
    : { privacyModeEnabled: false, setPrivacyModeEnabled };

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
