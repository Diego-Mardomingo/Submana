import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Si Supabase redirige con error (antes de llegar a exchangeCodeForSession)
  if (errorParam) {
    console.error("[auth/callback] Supabase error:", errorParam, errorDescription);
    const params = new URLSearchParams({
      error: "auth_callback_error",
      ...(errorDescription && { error_detail: errorDescription }),
    });
    return NextResponse.redirect(`${origin}/login?${params.toString()}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] exchangeCodeForSession error:", error.message, error);
    const params = new URLSearchParams({
      error: "auth_callback_error",
      error_detail: error.message,
    });
    return NextResponse.redirect(`${origin}/login?${params.toString()}`);
  }

  const params = new URLSearchParams({ error: "auth_callback_error" });
  return NextResponse.redirect(`${origin}/login?${params.toString()}`);
}
