"use client";

import { createClientStore } from "@/lib/clientStore";
import type { Lang } from "@/lib/i18n/ui";

const COOKIE = "submana-lang";

const langStore = createClientStore<Lang>(
  () => (document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`))?.[1] === "es" ? "es" : "en"),
  (lang) => {
    document.cookie = `${COOKIE}=${lang}; path=/; max-age=${60 * 60 * 24 * 365}`;
  },
  "en"
);

export const useLang = langStore.useValue;
export const setLang = langStore.set;
