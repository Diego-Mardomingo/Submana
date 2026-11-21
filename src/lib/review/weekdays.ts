import type { Lang } from "@/lib/i18n/ui";

/** ISO weekdays, Monday first. */
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** "lunes" / "Monday" for an ISO weekday (1 = Monday). */
export function weekdayName(day: number, lang: Lang, style: "long" | "short" = "long") {
  // 2024-01-01 was a Monday.
  const date = new Date(Date.UTC(2024, 0, day, 12));
  return date.toLocaleDateString(lang === "es" ? "es-ES" : "en-GB", { weekday: style, timeZone: "UTC" }).replace(".", "");
}
