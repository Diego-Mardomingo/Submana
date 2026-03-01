import Navigation from "@/components/Navigation";
import { NavigationDirectionTracker } from "@/components/NavigationDirectionTracker";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <NavigationDirectionTracker />
      <Navigation />
      <div className="auth-content-shell">{children}</div>
    </>
  );
}
