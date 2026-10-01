"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/hooks/useLang";
import type { MonthNavigation } from "@/hooks/useMonthNavigation";
import { useTranslations } from "@/lib/i18n/utils";
import styles from "./MonthNav.module.css";

/** Period switcher at the top of month-based cards; tapping the label returns to the current period. */
export function MonthNav({ nav }: { nav: MonthNavigation }) {
  const t = useTranslations(useLang());
  return (
    <div className={styles.monthNav}>
      <Button variant="ghost" size="icon" onClick={nav.goToPrev} className={styles.navButton} aria-label="Previous">
        <ChevronLeft className="size-4" strokeWidth={1.5} />
      </Button>
      <button
        type="button"
        onClick={nav.goToCurrent}
        className={styles.monthLabel}
        title={nav.isCurrent ? undefined : t("calendar.today")}
      >
        <span>{nav.label}</span>
        {!nav.isCurrent && <span className={styles.currentIndicator}>●</span>}
      </button>
      <Button variant="ghost" size="icon" onClick={nav.goToNext} className={styles.navButton} aria-label="Next">
        <ChevronRight className="size-4" strokeWidth={1.5} />
      </Button>
    </div>
  );
}
