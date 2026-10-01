import { Logo } from "@/components/Logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoginForm } from "./LoginForm";

/** Signed-in users never get here: the proxy redirects them to /transactions. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="login-page flex min-h-dvh items-center justify-center p-6">
      <section className="login-section flex flex-col items-center justify-center rounded-2xl border border-[var(--gris)] bg-[var(--gris-oscuro)] text-center">
        <Logo variant="login" />
        <div className="login-separator h-px w-[80%] bg-[var(--gris)] max-[600px]:w-[90%]" />
        {error === "auth_callback_error" && (
          <Alert variant="destructive" className="w-full max-w-[20rem]">
            <AlertDescription className="text-center">Error al iniciar sesión. Contacta con un administrador.</AlertDescription>
          </Alert>
        )}
        <LoginForm />
      </section>
    </div>
  );
}
