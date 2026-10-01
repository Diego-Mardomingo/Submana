"use client";

import { createClientStore } from "@/lib/clientStore";

const STORAGE_KEY = "submana-privacy-mode";

const privacyStore = createClientStore(
  () => localStorage.getItem(STORAGE_KEY) === "true",
  (enabled) => localStorage.setItem(STORAGE_KEY, String(enabled)),
  false
);

/** Hides amounts until revealed (setting persisted in this browser). */
export const usePrivacyMode = privacyStore.useValue;
export const setPrivacyMode = privacyStore.set;
