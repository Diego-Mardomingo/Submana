import { EdgeSwipeBack } from "@/components/EdgeSwipeBack";
import Navigation from "@/components/Navigation";
import { NavigationEffects } from "@/components/NavigationEffects";
import { AppBadgeSync } from "@/components/notifications/AppBadgeSync";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { NotificationLangSync } from "@/components/notifications/NotificationLangSync";
import { PullToRefresh } from "@/components/PullToRefresh";
import { RealtimeSync } from "@/components/RealtimeSync";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavigationEffects />
      <PullToRefresh />
      <EdgeSwipeBack />
      <RealtimeSync />
      <NotificationLangSync />
      <AppBadgeSync />
      <Navigation />
      <NotificationBell />
      <div className="auth-content-shell">{children}</div>
    </>
  );
}
