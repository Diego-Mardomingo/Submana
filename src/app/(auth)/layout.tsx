import Navigation from "@/components/Navigation";
import { NavigationEffects } from "@/components/NavigationEffects";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { NotificationLangSync } from "@/components/notifications/NotificationLangSync";
import { RealtimeSync } from "@/components/RealtimeSync";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavigationEffects />
      <RealtimeSync />
      <NotificationLangSync />
      <Navigation />
      <NotificationBell />
      <div className="auth-content-shell">{children}</div>
    </>
  );
}
