"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function LoginForm() {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);

  async function handleOAuth() {
    setIsLoading(true);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/api/auth/callback`,
      },
    });
    if (!error && data.url) {
      window.location.href = data.url;
      return;
    }
    setIsLoading(false);
  }

  return (
    <form className="login-form w-full">
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={handleOAuth}
        disabled={isLoading}
        aria-busy={isLoading}
        className="w-full justify-center gap-3 border-[var(--gris)] bg-[var(--negro)] py-6 text-base font-medium hover:border-[var(--accent)] hover:bg-[var(--gris)]"
      >
        <span className="flex shrink-0">
          <Image
            src="/google-logo.png"
            alt="Logo de Google"
            width={24}
            height={24}
            className="size-6 object-contain"
          />
        </span>
        <span className="relative flex min-w-[11rem] flex-1 items-center justify-center">
          <span className={isLoading ? "invisible" : ""}>Continue with Google</span>
          {isLoading && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Spinner className="size-6 text-[var(--accent)]" />
            </span>
          )}
        </span>
      </Button>
    </form>
  );
}
