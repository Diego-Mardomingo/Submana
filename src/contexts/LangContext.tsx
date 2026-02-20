"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { Lang } from "@/lib/i18n/ui";

const COOKIE_NAME = "submana-lang";

function getLangFromStorage(): Lang {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`)
  );
  const value = match ? decodeURIComponent(match[1]) : null;
  return value === "es" ? "es" : "en";
}

type LangContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
};

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLangState(getLangFromStorage());
    setMounted(true);
  }, []);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem(COOKIE_NAME, newLang);
    document.cookie = `${COOKIE_NAME}=${newLang}; path=/; max-age=${60 * 60 * 24 * 365}`;
  }, []);

  const value = mounted ? { lang, setLang } : { lang: "en" as Lang, setLang };

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
