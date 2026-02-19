import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedPaths = ["/", "/accounts", "/categories", "/subscriptions", "/transactions", "/settings", "/notifications", "/subscription"];
const staticPaths = ["/_next/static", "/_next/image", "/favicon", "/icons", "/sw.js", "/manifest"];

function isProtectedPath(pathname: string) {
  if (pathname === "/" || pathname === "") return true;
  return protectedPaths.some((p) => p !== "/" && pathname.startsWith(p));
}

function isStaticPath(pathname: string) {
  return staticPaths.some((p) => pathname.startsWith(p) || pathname === p);
}

function hasSupabaseAuthCookies(request: NextRequest): boolean {
  const cookies = request.cookies.getAll();
  return cookies.some((c) => c.name.startsWith("sb-") && c.name.includes("auth"));
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isStaticPath(pathname) || pathname.startsWith("/api/auth/callback")) {
    return NextResponse.next({ request });
  }

  if (isProtectedPath(pathname) && !hasSupabaseAuthCookies(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    if (isProtectedPath(pathname)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) user = data.user;
  } catch {
    user = null;
  }

  if (isProtectedPath(pathname) && !user) {
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
    redirectResponse.headers.set("Cache-Control", "no-store, must-revalidate");
    return redirectResponse;
  }

  if (pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/transactions", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|api/auth/callback).*)",
  ],
};
