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

/** Parsea YYYY-MM-DD a Date en hora local (mediodía para evitar edge cases de DST) */
export function parseDateString(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}
