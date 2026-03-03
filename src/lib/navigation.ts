/**
 * Route depth and parent route for hierarchical (tree) navigation.
 * Used for back navigation: back = go to parent level, not browser history.
 *
 * Depth levels:
 * - 0: Home (root)
 * - 1: Main pages (nav items)
 * - 2: Detail/Create pages
 * - 3: Edit pages
 */

const STATIC_ROUTE_DEPTH: Record<string, number> = {
  "/": 0,
  "/dashboard": 1,
  "/transactions": 1,
  "/accounts": 1,
  "/subscriptions": 1,
  "/categories": 1,
  "/budgets": 1,
  "/notifications": 1,
  "/settings": 1,
  "/transactions/new": 2,
  "/subscriptions/new": 2,
};

/**
 * Get the depth level for a given route path.
 * Handles both static routes and dynamic routes with parameters.
 */
export function getRouteDepth(path: string): number {
  const normalized = path.replace(/\/$/, "") || "/";
  if (STATIC_ROUTE_DEPTH[normalized] !== undefined) {
    return STATIC_ROUTE_DEPTH[normalized];
  }

  const segments = normalized.split("/").filter(Boolean);

  // /account/[id] or /subscription/[id] -> depth 2
  if (segments.length === 2 && (segments[0] === "account" || segments[0] === "subscription")) {
    return 2;
  }

  // /account/[id]/edit or /subscription/[id]/edit -> depth 3
  if (segments.length === 3 && segments[2] === "edit") {
    return 3;
  }

  // /transactions/edit/[id] -> depth 3
  if (segments.length === 3 && segments[0] === "transactions" && segments[1] === "edit") {
    return 3;
  }

  return 1;
}

/**
 * Get the parent route in the navigation tree for a given pathname.
 * Back button (browser or UI) should navigate to this route.
 * - Level 0 (home) -> stay home
 * - Level 1 -> home
 * - Level 2 -> list page (e.g. /subscriptions, /accounts)
 * - Level 3 -> detail page (e.g. /subscription/[id], /account/[id])
 */
export function getParentRoute(pathname: string): string {
  const path = pathname.replace(/\/$/, "") || "/";

  if (path === "/") return "/";

  const depth = getRouteDepth(path);
  const segments = path.split("/").filter(Boolean);

  if (depth === 1) return "/";

  if (depth === 2) {
    if (path === "/transactions/new") return "/transactions";
    if (path === "/subscriptions/new") return "/subscriptions";
    if (segments[0] === "account" && segments.length === 2) return "/accounts";
    if (segments[0] === "subscription" && segments.length === 2) return "/subscriptions";
  }

  if (depth === 3) {
    // /account/[id]/edit -> /account/[id]
    if (segments[0] === "account" && segments[2] === "edit") {
      return `/${segments[0]}/${segments[1]}`;
    }
    // /subscription/[id]/edit -> /subscription/[id]
    if (segments[0] === "subscription" && segments[2] === "edit") {
      return `/${segments[0]}/${segments[1]}`;
    }
    // /transactions/edit/[id] -> /transactions
    if (segments[0] === "transactions" && segments[1] === "edit") {
      return "/transactions";
    }
  }

  return "/";
}
