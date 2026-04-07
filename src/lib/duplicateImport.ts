import { formatInTimeZone } from "date-fns-tz";

const MADRID = "Europe/Madrid";

/**
 * Clave de día calendario para emparejar manual vs importación (solo año-mes-día).
 * - Cadenas solo fecha YYYY-MM-DD: se usan tal cual (intención del usuario en formularios).
 * - Instantes ISO con hora: día en Europe/Madrid (extracto Revolut).
 */
export function calendarDateKeyForDuplicate(dateValue: string): string {
	const s = dateValue.trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
		return s;
	}
	const d = new Date(s);
	if (Number.isNaN(d.getTime())) {
		const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
		return m ? m[1]! : s;
	}
	return formatInTimeZone(d, MADRID, "yyyy-MM-dd");
}

/** Misma cantidad en céntimos (sin tolerancia). */
export function amountsEqualExactCents(a: number, b: number): boolean {
	return Math.round(Number(a) * 100) === Math.round(Number(b) * 100);
}
