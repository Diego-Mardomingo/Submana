/**
 * Parent of a route in the app tree: "back" goes up one level instead of through browser
 * history (home → sections → detail/new → edit).
 */
export function getParentRoute(pathname: string): string {
  const [section, id, action] = pathname.split("/").filter(Boolean);
  if (section === "transactions" && id === "edit") return "/transactions";
  if ((section === "account" || section === "subscription") && id) return action === "edit" ? `/${section}/${id}` : `/${section}s`;
  if (id === "new") return `/${section}`;
  return "/";
}

/** Levels below home (0 for "/"). */
export function getRouteDepth(pathname: string): number {
  const path = pathname.replace(/\/$/, "") || "/";
  return path === "/" ? 0 : 1 + getRouteDepth(getParentRoute(path));
}

/** Internal paths only ("/x"); prevents open redirects through "//host", "/\host" or "@host". */
export function safeInternalPath(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
