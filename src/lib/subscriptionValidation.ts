export const SUBSCRIPTION_FREQUENCIES = ["weekly", "monthly", "yearly"] as const;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

/**
 * Valida los campos presentes de una suscripción (alta o edición parcial).
 * Devuelve un código de error o null. Un frequency_value < 1 hace que los
 * bucles de próximas fechas del cliente no terminen nunca.
 */
export function validateSubscriptionFields(fields: Record<string, unknown>): string | null {
  if ("cost" in fields) {
    const cost = Number(fields.cost);
    if (!Number.isFinite(cost) || cost < 0) return "invalid_cost";
  }
  if ("frequency" in fields) {
    if (!SUBSCRIPTION_FREQUENCIES.includes(fields.frequency as (typeof SUBSCRIPTION_FREQUENCIES)[number])) {
      return "invalid_frequency";
    }
  }
  if ("frequency_value" in fields) {
    const value = Number(fields.frequency_value);
    if (!Number.isInteger(value) || value < 1 || value > 1000) return "invalid_frequency_value";
  }
  if ("start_date" in fields) {
    if (typeof fields.start_date !== "string" || !ISO_DAY.test(fields.start_date)) return "invalid_start_date";
  }
  if ("end_date" in fields && fields.end_date != null && fields.end_date !== "") {
    if (typeof fields.end_date !== "string" || !ISO_DAY.test(fields.end_date)) return "invalid_end_date";
  }
  return null;
}
