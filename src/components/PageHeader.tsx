import type { ReactNode } from "react";

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
      {children}
    </header>
  );
}
