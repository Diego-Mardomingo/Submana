"use client";

import { useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories, type CategoryWithSubs } from "@/hooks/useCategories";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
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

export default function DashboardTopCategoriesBar() {
  const lang = useLang();
  const t = useTranslations(lang);
  const now = new Date();
  const { data: transactions = [], isLoading: txLoading } = useTransactions(now.getFullYear(), now.getMonth() + 1);
  const { data: categoriesData, isLoading: catLoading } = useCategories();

  const chartData = useMemo(() => {
    const defaultCats = categoriesData?.defaultCategories ?? [];
    const userCats = categoriesData?.userCategories ?? [];
    const { idToName, subToParent } = buildCategoryMaps(defaultCats, userCats, lang);
    const byCategory = new Map<string, number>();

    for (const tx of transactions as Tx[]) {
      if (tx.type !== "expense") continue;
      const amt = Number(tx.amount) || 0;
      const parentId =
        tx.category_id ??
        (tx.subcategory_id ? subToParent.get(tx.subcategory_id) : undefined) ??
        tx.subcategory_id ??
        "__uncategorized__";
      byCategory.set(parentId, (byCategory.get(parentId) ?? 0) + amt);
    }

    return Array.from(byCategory.entries())
      .map(([id, value]) => ({
        name: id === "__uncategorized__" ? t("home.uncategorized") : idToName.get(id) ?? id,
        value: Math.round(value * 100) / 100,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [transactions, categoriesData, lang, t]);

  const isLoading = txLoading || catLoading;

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.topCategories")}
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
            {t("dashboard.topCategories")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">{t("home.noExpensesThisMonth")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-muted-foreground">
          {t("dashboard.topCategories")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="dashboard-chart w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), ""]}
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--blanco)",
                }}
              />
              <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
