import Navigation from "@/components/Navigation";
import { NavigationDirectionTracker } from "@/components/NavigationDirectionTracker";
import { BackNavigationHandler } from "@/components/BackNavigationHandler";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <NavigationDirectionTracker />
      <BackNavigationHandler />
      <Navigation />
      <div className="auth-content-shell">{children}</div>
    </>
  );
}
