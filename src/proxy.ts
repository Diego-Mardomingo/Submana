import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Paths reachable without a session; API routes authenticate themselves. */
const PUBLIC_PREFIXES = ["/login", "/~offline", "/api", "/icons", "/sw.js", "/swe-worker", "/manifest", "/favicon", "/google-logo"];

const toLogin = (request: NextRequest) => {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.headers.set("Cache-Control", "no-store, must-revalidate");
  return response;
};

/** Refreshes the Supabase session cookies and keeps signed-out users on /login. */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth"));
  if (!isPublic && !hasAuthCookie) return toLogin(request);
  if (isPublic && (pathname !== "/login" || !hasAuthCookie)) return NextResponse.next();

  const response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });
  const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  if (!isPublic && !data.user) return toLogin(request);
  if (pathname === "/login" && data.user) return NextResponse.redirect(new URL("/transactions", request.url));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
