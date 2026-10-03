import Navigation from "@/components/Navigation";
import { NavigationEffects } from "@/components/NavigationEffects";
import { RealtimeSync } from "@/components/RealtimeSync";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavigationEffects />
      <RealtimeSync />
      <Navigation />
      <div className="auth-content-shell">{children}</div>
    </>
  );
}
