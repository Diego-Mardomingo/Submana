import type { ReactNode } from "react";
import { MonthNav } from "@/components/MonthNav";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { MonthNavigation } from "@/hooks/useMonthNavigation";
import { cn } from "@/lib/utils";

/** Card shell shared by dashboard/home widgets: title, optional period switcher and loading state. */
export function DashboardCard(props: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  nav?: MonthNavigation;
  loading?: boolean;
  /** Dims the content while newer data is fetched in the background. */
  refreshing?: boolean;
  className?: string;
  contentClassName?: string;
  children?: ReactNode;
}) {
  const { title, description, action, nav, loading, refreshing, className = "dashboard-card", contentClassName, children } = props;
  return (
    <Card className={className} ref={nav?.setSwipeElement}>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-muted-foreground">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className={cn("transition-opacity", refreshing && "opacity-70", contentClassName)}>
        {nav && <MonthNav nav={nav} />}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

/** Centered muted message for empty widgets. */
export const EmptyState = ({ children }: { children: ReactNode }) => (
  <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>
);
