export const SCROLL_RESTORE_KEY = "submana_scroll_restore";

export function saveScrollForReturn(path: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    SCROLL_RESTORE_KEY,
    JSON.stringify({ path, scrollY: window.scrollY })
  );
}
