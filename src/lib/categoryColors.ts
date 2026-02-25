/**
 * Paleta de colores para badges de categorías.
 * Mismo color para categoría padre y sus subcategorías (todas las de "Alimentación" = X color).
 * Categorías diferentes = colores diferentes.
 * Funciona bien en tema claro y oscuro.
 */
const CATEGORY_BADGE_PALETTE = [
  "#a78bfa", /* violeta (accent) */
  "#6366f1", /* indigo */
  "#60a5fa", /* azul */
  "#22d3ee", /* cyan */
  "#2dd4bf", /* teal */
  "#34d399", /* esmeralda */
  "#fbbf24", /* ámbar */
  "#fb923c", /* naranja */
  "#e879f9", /* fucsia */
  "#93c5fd", /* azul cielo */
  "#6ee7b7", /* verde menta */
  "#c084fc", /* violeta claro */
  "#38bdf8", /* azul cielo intenso */
  "#a3e635", /* lima */
  "#f472b6", /* rosa */
  "#818cf8", /* violeta índigo */
] as const;

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h);
}

/**
 * Devuelve bg y fg para un badge de categoría.
 * El key debe ser el ID de la categoría padre (todas las subcategorías de un mismo padre usan el mismo key).
 */
export function getCategoryBadgeColor(
  colorKey: string
): { bg: string; fg: string } {
  const idx = hashString(colorKey) % CATEGORY_BADGE_PALETTE.length;
  const hex = CATEGORY_BADGE_PALETTE[idx];
  return {
    bg: `${hex}20`,
    fg: hex,
  };
}
