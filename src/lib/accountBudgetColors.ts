/**
 * Paleta única para cuentas y presupuestos.
 * Saturación media, coherente con la app. Sin rojo, negro ni blanco.
 * Legible en tema claro y oscuro.
 */
export const ACCOUNT_BUDGET_COLORS = [
  "#a78bfa", /* violeta (accent) */
  "#6366f1", /* indigo */
  "#60a5fa", /* azul */
  "#22d3ee", /* cyan */
  "#2dd4bf", /* teal */
  "#34d399", /* esmeralda */
  "#fbbf24", /* ámbar */
  "#fb923c", /* naranja */
  "#e879f9", /* fucsia */
] as const;

export const defaultAccountBudgetColor = ACCOUNT_BUDGET_COLORS[0];
