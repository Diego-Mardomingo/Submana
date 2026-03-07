"use client";

import { useMemo, useEffect, useState } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories, type CategoryWithSubs } from "@/hooks/useCategories";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { Bar } from "react-chartjs-2";
import { Spinner } from "@/components/ui/spinner";
import { resolveChartPalette, tooltipConfig, axisConfig, formatK } from "@/lib/chartConfig";
import { detectTransferIds } from "@/lib/transferDetection";
import { filterForMetrics } from "@/lib/metricsFilters";

type Tx = { id: string; amount?: number; type?: string; date?: string; category_id?: string | null; subcategory_id?: string | null; account_id?: string };

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
  const defaultPalette = ["#6366f1", "#10b981", "#3b82f6", "#f59e0b", "#14b8a6", "#ef4444", "#ec4899", "#8b5cf6", "#06b6d4", "#f97316"];
  const [colors, setColors] = useState<string[]>(defaultPalette);

  useEffect(() => {
    setColors(resolveChartPalette());
  }, []);

  const chartData = useMemo(() => {
    const defaultCats = categoriesData?.defaultCategories ?? [];
    const userCats = categoriesData?.userCategories ?? [];
    const { idToName, subToParent } = buildCategoryMaps(defaultCats, userCats, lang);
    const ctx = { defaultCategories: defaultCats, userCategories: userCats };
    const byCategory = new Map<string, number>();

    const txList = transactions as Tx[];
    const transferIds = detectTransferIds(txList.map((tx) => ({ id: tx.id, amount: Number(tx.amount) || 0, type: tx.type || "", date: tx.date || "", account_id: tx.account_id })));
    const forMetrics = filterForMetrics(
      txList.filter((tx) => tx.type === "expense" && !transferIds.has(tx.id)),
      ctx
    );

    for (const tx of forMetrics) {
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

  const barData = useMemo(() => ({
    labels: chartData.map((d) => d.name),
    datasets: [{
      data: chartData.map((d) => d.value),
      backgroundColor: chartData.map((_, i) => colors[i % colors.length]),
      borderRadius: 4,
    }],
  }), [chartData, colors]);

  const barOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y" as const,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      tooltip: {
        ...tooltipConfig(),
        callbacks: {
          label: (ctx: { parsed: { x: number | null } }) => formatCurrency(ctx.parsed.x ?? 0),
        },
      },
      legend: { display: false },
    },
    scales: {
      x: {
        ...axisConfig(),
        ticks: { ...axisConfig().ticks, callback: formatK },
      },
      y: {
        ...axisConfig(),
        ticks: { ...axisConfig().ticks, font: { size: 11 } },
      },
    },
  }), []);

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
          <Bar data={barData} options={barOptions} />
        </div>
      </CardContent>
    </Card>
  );
}
