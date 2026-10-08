"use client";

import { getLang } from "@/hooks/useLang";
import { getTranslations } from "./utils";

/** Translator for the language chosen right now, for code outside React (query cache, toast callbacks). */
export const currentT = () => getTranslations(getLang());
