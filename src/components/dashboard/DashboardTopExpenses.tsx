"use client";

import { useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories, type CategoryWithSubs } from "@/hooks/useCategories";
import { formatCurrency } from "@/lib/format";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { Spinner } from "@/components/ui/spinner";
import { detectTransferIds } from "@/lib/transferDetection";
import { filterForMetrics } from "@/lib/metricsFilters";
import { getCategoryIcon } from "@/lib/categoryIcons";

type Tx = {
  id: string;
  description?: string;
  amount?: number;
  type?: string;
  date?: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  account_id?: string;
};

function buildMaps(
  defaultCats: CategoryWithSubs[],
  userCats: CategoryWithSubs[],
  lang: string
) {
  const idToName = new Map<string, string>();
  const idToIcon = new Map<string, string>();
  const subToParent = new Map<string, string>();

  const walk = (list: CategoryWithSubs[]) => {
    for (const parent of list) {
      const name = lang === "en" && parent.name_en ? parent.name_en : parent.name;
      idToName.set(parent.id, name);
      const iconKey = parent.emoji ?? parent.icon;
      if (iconKey) idToIcon.set(parent.id, iconKey);
      for (const sub of parent.subcategories ?? []) {
        const subName = lang === "en" && sub.name_en ? sub.name_en : sub.name;
        idToName.set(sub.id, subName);
        const subIconKey = sub.emoji ?? sub.icon;
        if (subIconKey) idToIcon.set(sub.id, subIconKey);
        subToParent.set(sub.id, parent.id);
      }
    }
  };
  walk(defaultCats);
  walk(userCats);
  return { idToName, idToIcon, subToParent };
}

export default function DashboardTopExpenses() {
  const lang = useLang();
  const t = useTranslations(lang);
  const now = new Date();
  const { data: transactions = [], isLoading: txLoading } = useTransactions(now.getFullYear(), now.getMonth() + 1);
  const { data: categoriesData, isLoading: catLoading } = useCategories();

  const topExpenses = useMemo(() => {
    const defaultCats = categoriesData?.defaultCategories ?? [];
    const userCats = categoriesData?.userCategories ?? [];
    const { idToName, idToIcon, subToParent } = buildMaps(defaultCats, userCats, lang);

    const txList = transactions as Tx[];
    const transferIds = detectTransferIds(
      txList.map((tx) => ({ id: tx.id, amount: Number(tx.amount) || 0, type: tx.type || "", date: tx.date || "", account_id: tx.account_id }))
    );
    const ctx = { defaultCategories: defaultCats, userCategories: userCats };
    const expenses = filterForMetrics(
      txList.filter((tx) => tx.type === "expense" && !transferIds.has(tx.id)),
      ctx
    )
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
      .slice(0, 5);

    return expenses.map((tx) => {
      const catId = tx.category_id ?? (tx.subcategory_id ? subToParent.get(tx.subcategory_id) : undefined) ?? tx.subcategory_id;
      const catName = catId ? idToName.get(catId) ?? "" : "";
      const iconKey = catId
        ? idToIcon.get(catId) ?? idToIcon.get(subToParent.get(catId) ?? "") ?? undefined
        : undefined;
      const d = tx.date ? new Date(tx.date) : null;
      const dateStr = d
        ? d.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", { day: "numeric", month: "short" })
        : "";

      return {
        id: tx.id,
        description: tx.description || catName || (lang === "es" ? "Sin descripción" : "No description"),
        amount: Number(tx.amount) || 0,
        dateStr,
        iconKey,
        catName,
      };
    });
  }, [transactions, categoriesData, lang]);

  const isLoading = txLoading || catLoading;

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.topExpenses")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="size-6 text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (topExpenses.length === 0) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.topExpenses")}
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
          {t("dashboard.topExpenses")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {topExpenses.map((tx, i) => (
          <div key={tx.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
            <div className="flex-shrink-0 size-8 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
              {getCategoryIcon(tx.iconKey, 16)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{tx.description}</p>
              <p className="text-xs text-muted-foreground">{tx.dateStr}{tx.catName ? ` · ${tx.catName}` : ""}</p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-danger">
              -<SensitiveAmount>{formatCurrency(tx.amount)}</SensitiveAmount>
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
