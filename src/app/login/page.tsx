import { cookies } from "next/headers";
import { Logo } from "@/components/Logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getTranslations } from "@/lib/i18n/utils";
import { LoginForm } from "./LoginForm";

/** Signed-in users never get here: the proxy redirects them to /transactions. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const t = getTranslations((await cookies()).get("submana-lang")?.value === "es" ? "es" : "en");
  return (
    <div className="login-page flex min-h-dvh items-center justify-center p-6">
      <section className="login-section flex flex-col items-center justify-center rounded-2xl border border-[var(--gris)] bg-[var(--gris-oscuro)] text-center">
        <Logo variant="login" />
        <div className="login-separator h-px w-[80%] bg-[var(--gris)] max-[600px]:w-[90%]" />
        {error === "auth_callback_error" && (
          <Alert variant="destructive" className="w-full max-w-[20rem]">
            <AlertDescription className="text-center">{t("login.error")}</AlertDescription>
          </Alert>
        )}
        <LoginForm />
      </section>
    </div>
  );
}
