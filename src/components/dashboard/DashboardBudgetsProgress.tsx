"use client";

import { useMemo } from "react";
import { useBudgets, type BudgetWithSpent } from "@/hooks/useBudgets";
import { useCategories, type CategoryWithSubs, type CategoryItem } from "@/hooks/useCategories";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Spinner } from "@/components/ui/spinner";

function currentMonthParam(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function DashboardBudgetsProgress() {
  const lang = useLang();
  const t = useTranslations(lang);
  const monthStr = currentMonthParam();
  const { data: budgets = [], isLoading } = useBudgets(monthStr);
  const { data: categoriesData } = useCategories();

  const { categoryIdToName, categoryIdToColorKey } = useMemo(() => {
    const nameMap = new Map<string, string>();
    const colorKeyMap = new Map<string, string>();
    const defaultCategories = categoriesData?.defaultCategories ?? [];
    const userCategories = categoriesData?.userCategories ?? [];
    const add = (cat: CategoryWithSubs | CategoryItem, parentId: string | null) => {
      const name = (cat as CategoryWithSubs).name_en && lang === "en" ? (cat as CategoryWithSubs).name_en! : cat.name;
      nameMap.set(cat.id, name);
      colorKeyMap.set(cat.id, parentId ?? cat.id);
    };
    for (const parent of [...defaultCategories, ...userCategories]) {
      add(parent, null);
      for (const sub of parent.subcategories ?? []) add(sub, parent.id);
    }
    return { categoryIdToName: nameMap, categoryIdToColorKey: colorKeyMap };
  }, [categoriesData, lang]);

  const getParentIds = (ids: string[]) => [...new Set(ids.map((id) => categoryIdToColorKey.get(id) ?? id))];

  const chartData = useMemo(() => {
    const getLabel = (b: BudgetWithSpent) => {
      const parentIds = getParentIds(b.categoryIds ?? []);
      if (parentIds.length) {
        const names = parentIds.map((id) => categoryIdToName.get(id)).filter(Boolean) as string[];
        return names.length > 0 ? names.join(", ") : t("budgets.generalBudget");
      }
      return t("budgets.generalBudget");
    };
    return (budgets as BudgetWithSpent[]).map((b) => {
      const amount = Number(b.amount);
      const spent = Number(b.spent ?? 0);
      const pct = amount > 0 ? Math.min(100, (spent / amount) * 100) : 0;
      const over = spent > amount;
      const color = over ? "var(--danger)" : pct >= 80 ? "var(--warning)" : "var(--chart-2)";
      return {
        name: getLabel(b),
        value: pct,
        spent,
        amount,
        color,
      };
    });
  }, [budgets, categoryIdToName, categoryIdToColorKey, t]);

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.budgetsVsSpent")}
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
            {t("dashboard.budgetsVsSpent")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">{t("home.noActiveBudgets")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-muted-foreground">
          {t("dashboard.budgetsVsSpent")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="dashboard-chart w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <XAxis type="number" domain={[0, 120]} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <Tooltip
                formatter={(value: number, _name: string, props: { payload: { spent: number; amount: number } }) => [
                  `${formatCurrency(props.payload.spent)} / ${formatCurrency(props.payload.amount)}`,
                  "",
                ]}
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--blanco)",
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
