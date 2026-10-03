/**
 * Parent of a route in the app tree (home → sections → account page), used to pick the
 * direction of page transitions. Creating and editing happen in sheets, not routes.
 */
export function getParentRoute(pathname: string): string {
  const [section, id] = pathname.split("/").filter(Boolean);
  if (section === "account" && id) return "/accounts";
  if (section === "subcount" && id) return "/subcount";
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
