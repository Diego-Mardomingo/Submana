"use client";

import { AlertTriangle } from "lucide-react";
import { DashboardCard, EmptyState } from "@/components/dashboard/DashboardCard";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { Progress } from "@/components/ui/progress";
import { useBudgets } from "@/hooks/useBudgets";
import { useCategoryLookup } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";
import { monthKey } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";

function progressColor(pct: number) {
  if (pct >= 100) return "var(--destructive, #ef4444)";
  if (pct >= 80) return "var(--warning, #f59e0b)";
  return "var(--chart-2, #22c55e)";
}

export default function HomeBudgetsCard() {
  const lang = useLang();
  const t = useTranslations(lang);
  const nav = useMonthNavigation(lang);
  const { data: budgets = [], isLoading, isFetching } = useBudgets(monthKey(nav.year, nav.month));
  const categories = useCategoryLookup();

  /** Names of the top-level categories linked to the budget (general budget when none). */
  const budgetLabel = (categoryIds: string[]) => {
    const roots = [...new Set(categoryIds.map((id) => categories.parent.get(id) ?? id))];
    const names = roots.map((id) => categories.name.get(id)).filter(Boolean);
    return names.length > 0 ? names.join(", ") : t("budgets.generalBudget");
  };

  return (
    <DashboardCard
      className="home-card"
      title={t("home.budgetsTitle")}
      nav={nav}
      loading={isLoading}
      refreshing={isFetching}
    >
      {budgets.length === 0 ? (
        <EmptyState>{t("home.noActiveBudgets")}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-4">
          {budgets.map((budget) => {
            const amount = Number(budget.amount);
            const spent = Number(budget.spent ?? 0);
            const pct = amount > 0 ? (spent / amount) * 100 : 0;
            return (
              <li key={budget.id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: budget.color ?? "var(--primary)" }} aria-hidden />
                  {spent > amount && <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />}
                  <span className="text-sm font-medium truncate">{budgetLabel(budget.categoryIds ?? [])}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  <SensitiveAmount>{formatCurrency(spent)}</SensitiveAmount>
                  {" / "}
                  <SensitiveAmount>{formatCurrency(amount)}</SensitiveAmount>
                </div>
                <Progress
                  value={Math.min(100, pct)}
                  className="h-2"
                  indicatorStyle={{ backgroundColor: spent > amount ? progressColor(100) : progressColor(pct) }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}
