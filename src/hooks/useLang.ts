"use client";

import { useLangContext } from "@/contexts/LangContext";

export function useLang() {
  return useLangContext().lang;
}
