"use client";

import { createClientStore } from "@/lib/clientStore";

const STORAGE_KEY = "submana-calendar-dots-only";

// localStorage can throw when site data is blocked; then the setting just isn't persisted.
const dotsOnlyStore = createClientStore(
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

/** Hides the calendar day numbers, leaving only the marks (setting persisted in this browser). */
export const useCalendarDotsOnly = dotsOnlyStore.useValue;
export const setCalendarDotsOnly = dotsOnlyStore.set;
