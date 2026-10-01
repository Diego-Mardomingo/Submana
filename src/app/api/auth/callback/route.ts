import { NextResponse } from "next/server";
import { safeInternalPath } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Supabase may redirect here with an error before any code exchange.
  const supabaseError = searchParams.get("error");
  let errorDetail = supabaseError ? searchParams.get("error_description") : null;

  if (!supabaseError && code) {
    const { error } = await (await createClient()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeInternalPath(searchParams.get("next"))}`);
    errorDetail = error.message;
  }

  console.error("[auth/callback]", errorDetail ?? "missing code");
  const params = new URLSearchParams({ error: "auth_callback_error", ...(errorDetail && { error_detail: errorDetail }) });
  return NextResponse.redirect(`${origin}/login?${params}`);
}
