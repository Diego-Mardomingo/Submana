import type { ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { HeaderBell } from "@/components/notifications/NotificationBell";

/** Right-hand side of a header: the notification bell (desktop) to the left of the page's own action, if any. */
function HeaderActions({ children }: { children?: ReactNode }) {
  if (!children) return <HeaderBell />;
  return (
    <div className="flex shrink-0 items-center gap-2">
      <HeaderBell />
      {children}
    </div>
  );
}

/** Title block shown at the top of every main page. */
export function PageHeader({ icon, title, subtitle, children }: {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-hand action, e.g. an add button. */
  children?: ReactNode;
}) {
  return (
    <header className="page-header-clean">
      <div className="page-header-left">
        <div className="page-header-icon">{icon}</div>
        <div className="page-header-text">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <HeaderActions>{children}</HeaderActions>
    </header>
  );
}

/**
 * One-line header for dense list pages: title plus an add action that is a round "+" on mobile
 * and a labelled pill from tablet up. The action is a link with `addHref`, otherwise a button.
 */
export function CompactPageHeader({ title, addLabel, addHref, onAdd }: {
  title: ReactNode;
  addLabel?: string;
  addHref?: string;
  onAdd?: () => void;
}) {
  const content = (
    <>
      <Plus className="size-5" strokeWidth={2.5} aria-hidden />
      <span className="lp-add-label">{addLabel}</span>
    </>
  );
  return (
    <header className="lp-header">
      <h1>{title}</h1>
      <HeaderActions>
        {addLabel &&
          (addHref ? (
            <Link href={addHref} className="add-btn lp-add" aria-label={addLabel}>
              {content}
            </Link>
          ) : (
            <button type="button" className="add-btn lp-add" onClick={onAdd} aria-label={addLabel}>
              {content}
            </button>
          ))}
      </HeaderActions>
    </header>
  );
}
