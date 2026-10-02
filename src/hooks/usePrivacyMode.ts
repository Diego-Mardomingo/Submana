"use client";

import { createClientStore } from "@/lib/clientStore";

const STORAGE_KEY = "submana-privacy-mode";

// localStorage can throw when site data is blocked; then the setting just isn't persisted.
const privacyStore = createClientStore(
  () => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  },
  (enabled) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {}
  },
  false
);

/** Hides amounts until revealed (setting persisted in this browser). */
export const usePrivacyMode = privacyStore.useValue;
export const setPrivacyMode = privacyStore.set;
