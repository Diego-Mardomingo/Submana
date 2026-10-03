export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;
const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;

/** Names that could impersonate the app or collide with routes. */
const RESERVED_HANDLES = new Set([
  "admin", "administrator", "submana", "support", "me", "root", "api", "help", "settings",
  "null", "undefined", "system", "moderator", "staff", "team", "official", "friends", "groups",
]);

export type HandleError = "handle_invalid" | "handle_reserved";

/** Canonical form: no leading "@", trimmed, lowercase. */
export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, "").trim().toLowerCase();
}

/** Error code for a handle (already normalised or not), or null when it is usable. */
export function validateHandle(input: string): HandleError | null {
  const handle = normalizeHandle(input);
  if (!HANDLE_PATTERN.test(handle)) return "handle_invalid";
  if (RESERVED_HANDLES.has(handle)) return "handle_reserved";
  return null;
}

/** Proposed handle from the Google profile: accents folded, only [a-z0-9_], 3-20 chars. */
export function suggestHandle(email: string | null | undefined, fullName: string | null | undefined): string {
  const clean = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[\s.\-]+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  const candidates = [clean(fullName ?? ""), clean((email ?? "").split("@")[0])];
  for (const candidate of candidates) {
    const handle = candidate.slice(0, HANDLE_MAX).replace(/_+$/, "");
    if (handle.length >= HANDLE_MIN && validateHandle(handle) === null) return handle;
  }
  return "user_" + Math.random().toString(36).slice(2, 8).padEnd(6, "0");
}
