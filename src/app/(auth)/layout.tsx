import Navigation from "@/components/Navigation";

export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navigation />
      <div className="auth-content-shell">{children}</div>
    </>
  );
}
