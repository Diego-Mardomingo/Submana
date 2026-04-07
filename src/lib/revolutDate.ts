import { fromZonedTime } from "date-fns-tz";

const MADRID = "Europe/Madrid";

/**
 * Interpreta "Fecha de inicio" del CSV Revolut (hora local de Madrid) y devuelve ISO UTC para timestamptz.
 */
export function parseRevolutFechaInicioToIsoUtc(fechaInicio: string): string | null {
	const raw = fechaInicio.trim();
	if (!raw) return null;
	const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
	const d = fromZonedTime(normalized, MADRID);
	if (Number.isNaN(d.getTime())) return null;
	return d.toISOString();
}

/** Milisegundos UTC para ordenar filas Revolut por fecha de inicio (Madrid). */
export function revolutFechaInicioToMs(fechaInicio: string): number {
	const iso = parseRevolutFechaInicioToIsoUtc(fechaInicio);
	return iso ? new Date(iso).getTime() : 0;
}
