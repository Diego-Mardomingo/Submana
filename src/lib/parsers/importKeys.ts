/**
 * Opaque import identities and duplicate-resolution keys, shared by client and server.
 * Their formats are persisted: changing them breaks deduplication of past imports.
 */
import { calendarDayInAppTimeZone } from "@/lib/date";

export async function sha256Hex(text: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Per-account unique id of a bank row. */
export const buildImportLineId = (accountId: string, importSourceFingerprint: string) => sha256Hex(`${accountId}|${importSourceFingerprint}`);

const cents = (amount: number) => Math.round(Number(amount) * 100);

/** Key of a manual-vs-import conflict (calendar day + exact cents + type) for import_duplicate_decisions. */
export const buildDuplicateConflictKey = (accountId: string, date: string, amount: number, type: string) =>
  sha256Hex(`${accountId}|${calendarDayInAppTimeZone(date)}|${cents(amount)}|${(type || "").trim().toLowerCase()}`);

/** Legacy key (day + amount) kept to honour decisions saved before the type was included. */
export const buildDuplicateConflictKeyLegacy = (accountId: string, date: string, amount: number) =>
  sha256Hex(`${accountId}|${calendarDayInAppTimeZone(date)}|${cents(amount)}`);
