"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { Lang } from "@/lib/i18n/ui";

const COOKIE_NAME = "submana-lang";

function getLangFromStorage(): Lang {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`)
  );
  const value = match ? decodeURIComponent(match[1]) : null;
  return value === "es" ? "es" : "en";
}

// La cookie es la fuente de verdad; los suscriptores se avisan al cambiarla.
const listeners = new Set<() => void>();
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

type LangContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
};

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  // En servidor e hidratación "en"; después, el valor de la cookie.
  const lang = useSyncExternalStore<Lang>(subscribe, getLangFromStorage, () => "en");

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((newLang: Lang) => {
    localStorage.setItem(COOKIE_NAME, newLang);
    document.cookie = `${COOKIE_NAME}=${newLang}; path=/; max-age=${60 * 60 * 24 * 365}`;
    listeners.forEach((listener) => listener());
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);

  return (
    <LangContext.Provider value={value}>
      {children}
    </LangContext.Provider>
  );
}

export function useLangContext() {
  const ctx = useContext(LangContext);
  if (!ctx) {
    throw new Error("useLangContext must be used within LangProvider");
  }
  return ctx;
}
