import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/**
 * Zona usada al persistir instantes de transacción (migración timestamptz) y para límites de mes en API.
 */
export const APP_TIME_ZONE = "Europe/Madrid";

/**
 * Rango UTC semiabierto [start, end) que cubre los meses de calendario indicados (1–12) en APP_TIME_ZONE.
 * Sirve para filtrar columnas timestamptz sin perder el día 1 (medianoche local) ni mezclar con el mes anterior en UTC.
 */
export function calendarMonthsUtcHalfOpenRange(
  startYear: number,
  startMonth1to12: number,
  endYear: number,
  endMonth1to12: number
): { startIso: string; endExclusiveIso: string } {
  const start = fromZonedTime(
    new Date(startYear, startMonth1to12 - 1, 1, 0, 0, 0, 0),
    APP_TIME_ZONE
  );
  let nextY = endYear;
  let nextM = endMonth1to12 + 1;
  if (nextM > 12) {
    nextM = 1;
    nextY += 1;
  }
  const endExclusive = fromZonedTime(
    new Date(nextY, nextM - 1, 1, 0, 0, 0, 0),
    APP_TIME_ZONE
  );
  return {
    startIso: start.toISOString(),
    endExclusiveIso: endExclusive.toISOString(),
  };
}

/**
 * Día de calendario (YYYY-MM-DD) en APP_TIME_ZONE para un instante ISO/timestamptz.
 * Alinea la agrupación en UI con los límites de mes de la API.
 */
export function calendarDayInAppTimeZone(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate.slice(0, 10);
  return formatInTimeZone(d, APP_TIME_ZONE, "yyyy-MM-dd");
}

/**
 * Utilidades para manejar fechas "solo día" (YYYY-MM-DD) sin problemas de huso horario.
 * - toISOString() convierte a UTC y puede cambiar el día en zonas UTC+
 * - new Date("YYYY-MM-DD") interpreta la cadena como medianoche UTC
 * Estas funciones usan siempre la hora local del usuario.
 */

/** Convierte un Date a YYYY-MM-DD usando la zona horaria local (evita el shift de UTC) */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parsea YYYY-MM-DD a Date en hora local (mediodía para evitar edge cases de DST).
 * Si la cadena incluye hora (ISO / timestamptz), devuelve ese instante.
 */
export function parseDateString(str: string): Date {
  if (!str) return new Date();
  if (str.length > 10 || str.includes("T")) {
    const parsed = new Date(str);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}
