/** Validation of the notification settings payload (pure: used by the settings route and its tests). */
import { isNotificationType, RENEWAL_OFFSETS, type RenewalOffset } from "./catalog";
import type { NotificationSettings } from "./types";

export type SettingsPatch = Partial<Pick<NotificationSettings, "lang" | "disabled_types" | "default_renewal_offsets" | "summary_day" | "push_hide_amounts">>;

/** Validated partial update, or the error code to answer with. Unknown fields are ignored. */
export function parseSettingsPatch(body: unknown): { patch: SettingsPatch } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid JSON body" };
  const input = body as Record<string, unknown>;
  const patch: SettingsPatch = {};

  if ("lang" in input) {
    if (input.lang !== "es" && input.lang !== "en") return { error: "invalid_lang" };
    patch.lang = input.lang;
  }
  if ("disabled_types" in input) {
    const value = input.disabled_types;
    if (!Array.isArray(value) || !value.every(isNotificationType)) return { error: "invalid_disabled_types" };
    patch.disabled_types = [...new Set(value)];
  }
  if ("default_renewal_offsets" in input) {
    const value = input.default_renewal_offsets;
    const allowed: readonly unknown[] = RENEWAL_OFFSETS;
    if (!Array.isArray(value) || !value.every((n) => allowed.includes(n))) return { error: "invalid_renewal_offsets" };
    patch.default_renewal_offsets = ([...new Set(value)] as RenewalOffset[]).sort((a, b) => a - b);
  }
  if ("summary_day" in input) {
    const day = input.summary_day;
    if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > 28) return { error: "invalid_summary_day" };
    patch.summary_day = day;
  }
  if ("push_hide_amounts" in input) {
    if (typeof input.push_hide_amounts !== "boolean") return { error: "invalid_push_hide_amounts" };
    patch.push_hide_amounts = input.push_hide_amounts;
  }
  return { patch };
}
