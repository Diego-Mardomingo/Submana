"use client";

import { useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories, type CategoryWithSubs } from "@/hooks/useCategories";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { chartTooltipStyle } from "@/components/ui/chart-tooltip";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { useChartTooltipControl } from "@/hooks/useChartTooltipControl";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CHART_COLORS } from "./chartColors";
import { Spinner } from "@/components/ui/spinner";

type Tx = { amount?: number; type?: string; category_id?: string | null; subcategory_id?: string | null };

function buildCategoryMaps(
  defaultCats: CategoryWithSubs[],
  userCats: CategoryWithSubs[],
  lang: string
): { idToName: Map<string, string>; subToParent: Map<string, string> } {
  const idToName = new Map<string, string>();
  const subToParent = new Map<string, string>();
  const walk = (list: CategoryWithSubs[]) => {
    for (const parent of list) {
      const name = lang === "en" && parent.name_en ? parent.name_en : parent.name;
      idToName.set(parent.id, name);
      for (const sub of parent.subcategories ?? []) {
        const subName = lang === "en" && sub.name_en ? sub.name_en : sub.name;
        idToName.set(sub.id, subName);
        subToParent.set(sub.id, parent.id);
      }
    }
  };
  walk(defaultCats);
  walk(userCats);
  return { idToName, subToParent };
}

export default function DashboardIncomeByCategoryDonut() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { containerRef, isTouch, tooltipKey } = useChartTooltipControl();
  const now = new Date();
  const { data: transactions = [], isLoading: txLoading } = useTransactions(now.getFullYear(), now.getMonth() + 1);
  const { data: categoriesData, isLoading: catLoading } = useCategories();

  const { chartData, totalIncome } = useMemo(() => {
    const defaultCats = categoriesData?.defaultCategories ?? [];
    const userCats = categoriesData?.userCategories ?? [];
    const { idToName, subToParent } = buildCategoryMaps(defaultCats, userCats, lang);
    const byCategory = new Map<string, number>();

    for (const tx of transactions as Tx[]) {
      if (tx.type !== "income") continue;
      const amt = Number(tx.amount) || 0;
      const parentId =
        tx.category_id ??
        (tx.subcategory_id ? subToParent.get(tx.subcategory_id) : undefined) ??
        tx.subcategory_id ??
        "__uncategorized__";
      byCategory.set(parentId, (byCategory.get(parentId) ?? 0) + amt);
    }

    const total = Array.from(byCategory.values()).reduce((s, v) => s + v, 0);
    const data = Array.from(byCategory.entries()).map(([id, value]) => ({
      name: id === "__uncategorized__" ? t("home.uncategorized") : idToName.get(id) ?? id,
      value: Math.round(value * 100) / 100,
    }));
    data.sort((a, b) => b.value - a.value);
    return { chartData: data, totalIncome: total };
  }, [transactions, categoriesData, lang, t]);

  const isLoading = txLoading || catLoading;

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.incomeByCategory")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="size-6 text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.incomeByCategory")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">{t("dashboard.noIncomeCategories")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-muted-foreground">
          {t("dashboard.incomeByCategory")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="dashboard-chart w-full" ref={containerRef}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="50%"
                outerRadius="80%"
                paddingAngle={2}
                stroke="transparent"
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                key={tooltipKey}
                trigger={isTouch ? "click" : "hover"}
                formatter={(value: number) => [
                  formatCurrency(value),
                  totalIncome > 0 ? `${((value / totalIncome) * 100).toFixed(1)}%` : "",
                ]}
                {...chartTooltipStyle}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
