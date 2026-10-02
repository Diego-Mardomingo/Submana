import { fromZonedTime } from "date-fns-tz";
import { APP_TIME_ZONE } from "@/lib/date";

/** Parses Revolut's "Fecha de inicio" (Madrid local time) into a UTC ISO string for timestamptz. */
export function parseRevolutFechaInicioToIsoUtc(fechaInicio: string): string | null {
  const raw = fechaInicio.trim();
  if (!raw) return null;
  const d = fromZonedTime(raw.includes("T") ? raw : raw.replace(" ", "T"), APP_TIME_ZONE);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** UTC milliseconds used to sort Revolut rows by start date. */
export function revolutFechaInicioToMs(fechaInicio: string): number {
  const iso = parseRevolutFechaInicioToIsoUtc(fechaInicio);
  return iso ? new Date(iso).getTime() : 0;
}
