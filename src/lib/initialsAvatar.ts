const AVATAR_COLORS = ["#8b5cf6", "#6366f1", "#0ea5e9", "#14b8a6", "#22c55e", "#f59e0b", "#f97316", "#ec4899", "#ef4444", "#64748b"];

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Avatar SVG con iniciales como data URI. Sustituye a ui-avatars.com: no envía el nombre
 * de la suscripción a un tercero y funciona offline. Color estable por nombre.
 */
export function initialsAvatarDataUri(name: string | null | undefined): string {
  const clean = (name || "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const initials =
    (words.length > 1 ? words[0][0] + words[1][0] : clean.slice(0, 2)).toUpperCase() || "?";
  let hash = 0;
  for (const ch of clean) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const color = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">` +
    `<rect width="256" height="256" fill="${color}"/>` +
    `<text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="system-ui,sans-serif" ` +
    `font-size="104" font-weight="600" fill="#fff">${escapeXml(initials)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
