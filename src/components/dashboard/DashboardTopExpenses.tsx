"use client";

import { DashboardCard, EmptyState } from "@/components/dashboard/DashboardCard";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { useCategoryLookup } from "@/hooks/useCategories";
import { useLang } from "@/hooks/useLang";
import { useMetricTransactions } from "@/hooks/useTransactions";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { formatCurrency, localeOf } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";

export default function DashboardTopExpenses() {
  const lang = useLang();
  const t = useTranslations(lang);
  const now = new Date();
  const { data: transactions, isLoading } = useMetricTransactions(now.getFullYear(), now.getMonth() + 1);
  const categories = useCategoryLookup();

  const top = transactions
    .filter((tx) => tx.type === "expense")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return (
    <DashboardCard
      title={t("dashboard.topExpenses")}
      loading={isLoading || categories.isLoading}
      contentClassName={top.length ? "space-y-1" : undefined}
    >
      {top.length === 0 && <EmptyState>{t("home.noExpensesThisMonth")}</EmptyState>}
      {top.map((tx) => {
        const catId = categories.rootOf(tx);
        const catName = catId ? (categories.name.get(catId) ?? "") : "";
        const iconKey = catId ? categories.icon.get(catId) : undefined;
        const date = new Date(tx.date).toLocaleDateString(localeOf(lang), { day: "numeric", month: "short" });
        return (
          <div key={tx.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
            <div className="flex-shrink-0 size-8 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
              {getCategoryIcon(iconKey, 16)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {tx.description || catName || (lang === "es" ? "Sin descripción" : "No description")}
              </p>
              <p className="text-xs text-muted-foreground">
                {date}
                {catName ? ` · ${catName}` : ""}
              </p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-danger">
              -<SensitiveAmount>{formatCurrency(tx.amount)}</SensitiveAmount>
            </span>
          </div>
        );
      })}
    </DashboardCard>
  );
}
