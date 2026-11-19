"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Saved in this browser; the pre-paint script in app/layout.tsx reads the same key. */
const STORAGE_KEY = "submana-sidebar";
const CHANGE_EVENT = "submana-sidebar-change";

/** The source of truth is html[data-sidebar], which the CSS reads, so the page never waits for React. */
const isCollapsed = () => document.documentElement.dataset.sidebar === "collapsed";

function apply(collapsed: boolean) {
  if (collapsed) document.documentElement.dataset.sidebar = "collapsed";
  else delete document.documentElement.dataset.sidebar;
}

function subscribe(onChange: () => void) {
  // Another tab changed it: follow along.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    apply(e.newValue === "collapsed");
    onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Whether the desktop sidebar is folded to its icon rail, and a setter that remembers it on this device. */
export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, isCollapsed, () => false);
  const setCollapsed = useCallback((next: boolean) => {
    apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "collapsed" : "expanded");
    } catch {
      // Private mode or storage blocked: it still works for this visit.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [collapsed, setCollapsed] as const;
}
