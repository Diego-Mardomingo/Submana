"use client";

import { useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories, type CategoryWithSubs } from "@/hooks/useCategories";
import { formatCurrency } from "@/lib/format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Spinner } from "@/components/ui/spinner";
import styles from "./HomeCategoryDonutCard.module.css";

/* Variables CSS del tema (--chart-* ya son colores completos: accent, success, info, warning, teal) */
const CATEGORY_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--danger)",
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
];

type Tx = {
  amount?: number;
  type?: string;
  category_id?: string | null;
  subcategory_id?: string | null;
};

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

export default function HomeCategoryDonutCard() {
  const lang = useLang();
  const t = useTranslations(lang);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const { data: transactions = [], isLoading: txLoading } = useTransactions(
    currentYear,
    currentMonth
  );
  const { data: categoriesData, isLoading: catLoading } = useCategories();

  const { chartData, totalExpense } = useMemo(() => {
    const defaultCats = categoriesData?.defaultCategories ?? [];
    const userCats = categoriesData?.userCategories ?? [];
    const { idToName, subToParent } = buildCategoryMaps(
      defaultCats,
      userCats,
      lang
    );

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

    const total = Array.from(byCategory.values()).reduce((s, v) => s + v, 0);
    const data = Array.from(byCategory.entries()).map(([id, value]) => ({
      name: id === "__uncategorized__" ? t("home.uncategorized") : idToName.get(id) ?? id,
      value: Math.round(value * 100) / 100,
      id,
    }));

    data.sort((a, b) => b.value - a.value);
    return { chartData: data, totalExpense: total };
  }, [transactions, categoriesData, lang, t]);

  const isLoading = txLoading || catLoading;

  if (isLoading) {
    return (
      <Card className="home-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("home.expensesByCategory")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Spinner className="size-6 text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="home-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-muted-foreground">
          {t("home.expensesByCategory")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("home.noExpensesThisMonth")}
          </p>
        ) : (
          <div className={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={1}
                  stroke="transparent"
                >
                  {chartData.map((_, index) => (
                    <Cell
                      key={index}
                      fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [
                    formatCurrency(value),
                    totalExpense > 0
                      ? `${((value / totalExpense) * 100).toFixed(1)}%`
                      : "",
                  ]}
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    color: "var(--blanco)",
                  }}
                  labelStyle={{ color: "var(--blanco)", fontWeight: 600 }}
                  itemStyle={{ color: "var(--blanco)" }}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  iconSize={isMobile ? 6 : 8}
                  iconType="circle"
                  wrapperStyle={{ fontSize: isMobile ? "0.6rem" : undefined }}
                  formatter={(value, _entry) => {
                    const item = chartData.find((d) => d.name === value);
                    const pct =
                      item && totalExpense > 0
                        ? ((item.value / totalExpense) * 100).toFixed(0)
                        : "0";
                    return `${value} (${pct}%)`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
