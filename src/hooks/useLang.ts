"use client";

import { useState, useEffect } from "react";
import type { Lang } from "@/lib/i18n/ui";

const COOKIE_NAME = "submana-lang";

function getLangFromDocument(): Lang {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`)
  );
  const value = match ? decodeURIComponent(match[1]) : null;
  return value === "es" ? "es" : "en";
}

export function useLang(): Lang {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    setLang(getLangFromDocument());
  }, []);

  return lang;
}
