import Navigation from "@/components/Navigation";
import { NavigationEffects } from "@/components/NavigationEffects";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavigationEffects />
      <Navigation />
      <div className="auth-content-shell">{children}</div>
    </>
  );
}
