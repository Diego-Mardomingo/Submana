"use client";

import { useMemo, useCallback } from "react";
import { useBudgets, type BudgetWithSpent } from "@/hooks/useBudgets";
import { useCategories, type CategoryWithSubs, type CategoryItem } from "@/hooks/useCategories";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";
import { formatCurrency } from "@/lib/format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import styles from "./HomeBudgetsCard.module.css";

export default function HomeBudgetsCard() {
  const lang = useLang();
  const t = useTranslations(lang);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const nav = useMonthNavigation(lang);

  const cardRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      nav.setSwipeElement(node);
    },
    [nav.setSwipeElement]
  );

  const monthStr = `${nav.year}-${String(nav.month).padStart(2, "0")}`;
  const { data: budgets = [], isLoading, isFetching } = useBudgets(monthStr);
  const { data: categoriesData } = useCategories();
  
  // Solo spinner si no hay datos previos
  const isInitialLoading = isLoading && budgets.length === 0;
  const isRefreshing = isFetching && !isInitialLoading;

  const { categoryIdToName, categoryIdToColorKey } = useMemo(() => {
    const nameMap = new Map<string, string>();
    const colorKeyMap = new Map<string, string>();
    const defaultCategories = categoriesData?.defaultCategories ?? [];
    const userCategories = categoriesData?.userCategories ?? [];
    const add = (cat: CategoryWithSubs | CategoryItem, parentId: string | null) => {
      const name = (cat as CategoryWithSubs).name_en && lang === "en"
        ? (cat as CategoryWithSubs).name_en!
        : cat.name;
      nameMap.set(cat.id, name);
      colorKeyMap.set(cat.id, parentId ?? cat.id);
    };
    for (const parent of [...defaultCategories, ...userCategories]) {
      add(parent, null);
      for (const sub of parent.subcategories ?? []) add(sub, parent.id);
    }
    return { categoryIdToName: nameMap, categoryIdToColorKey: colorKeyMap };
  }, [categoriesData, lang]);

  const getParentIds = (ids: string[]) =>
    [...new Set(ids.map((id) => categoryIdToColorKey.get(id) ?? id))];

  const getBudgetLabel = (budget: BudgetWithSpent) => {
    const parentIds = getParentIds(budget.categoryIds ?? []);
    if (parentIds.length) {
      const names = parentIds
        .map((id) => categoryIdToName.get(id))
        .filter(Boolean) as string[];
      return names.length > 0 ? names.join(", ") : t("budgets.generalBudget");
    }
    return t("budgets.generalBudget");
  };

  const getProgressColor = (pct: number, over: boolean) => {
    if (over) return "var(--destructive, #ef4444)";
    if (pct >= 100) return "var(--destructive, #ef4444)";
    if (pct >= 80) return "var(--warning, #f59e0b)";
    return "var(--chart-2, #22c55e)";
  };

  if (isInitialLoading) {
    return (
      <Card className="home-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("home.budgetsTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Spinner className="size-6 text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="home-card" ref={cardRefCallback}>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-muted-foreground">
          {t("home.budgetsTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent style={{ opacity: isRefreshing ? 0.7 : 1, transition: "opacity 0.2s" }}>
        <div className={styles.monthNav}>
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={nav.goToPrevMonth}
              className={styles.navButton}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" strokeWidth={1.5} />
            </Button>
          )}
          <button
            type="button"
            onClick={nav.goToCurrentMonth}
            className={styles.monthLabel}
            title={nav.isCurrentMonth ? undefined : t("calendar.today")}
          >
            <span>{nav.monthLabel}</span>
            {!nav.isCurrentMonth && (
              <span className={styles.currentIndicator}>●</span>
            )}
          </button>
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={nav.goToNextMonth}
              className={styles.navButton}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </Button>
          )}
        </div>
        {budgets.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("home.noActiveBudgets")}
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {budgets.map((budget: BudgetWithSpent) => {
              const amount = Number(budget.amount);
              const spent = Number(budget.spent ?? 0);
              const over = spent > amount;
              const pct = amount > 0 ? (spent / amount) * 100 : 0;
              const progressValue = amount > 0 ? Math.min(100, pct) : 0;
              const accent = budget.color ?? "var(--primary)";
              const progressColor = getProgressColor(pct, over);
              return (
                <li key={budget.id} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: accent }}
                      aria-hidden
                    />
                    {over && (
                      <AlertTriangle
                        className="size-4 shrink-0 text-destructive"
                        aria-hidden
                      />
                    )}
                    <span className="text-sm font-medium truncate">
                      {getBudgetLabel(budget)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(spent)} / {formatCurrency(amount)}
                  </div>
                  <Progress
                    value={progressValue}
                    className="h-2"
                    indicatorStyle={{ backgroundColor: progressColor }}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
