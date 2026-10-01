"use client";

import { useState } from "react";
import { Bar } from "react-chartjs-2";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { useLang } from "@/hooks/useLang";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useMonthNavigation } from "@/hooks/useMonthNavigation";
import { useMetricTransactions } from "@/hooks/useTransactions";
import { axisConfig, formatK, tooltipConfig, useChartTheme } from "@/lib/chartConfig";
import { toAppDate } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";

type Period = "week" | "month" | "year";

const WEEKDAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const MONTH_KEYS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export default function DashboardDailyExpenseBars() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { colors } = useChartTheme();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [period, setPeriod] = useState<Period>("month");
  const nav = useMonthNavigation(lang, period);

  const month = useMetricTransactions(nav.year, nav.month);
  // Without a month the API returns every transaction: enough for the year and week views.
  const all = useMetricTransactions();
  const { data, isLoading } = period === "month" ? month : all;
  const expenses = data.filter((tx) => tx.type === "expense").map((tx) => ({ date: toAppDate(tx.date), amount: tx.amount }));

  let labels: string[];
  let bucketOf: (d: Date) => number;
  if (period === "week") {
    labels = WEEKDAY_KEYS.map((k) => t(`calendar.${k}`));
    bucketOf = (d) => (d >= nav.weekStart && d <= nav.weekEnd ? Math.floor((d.getTime() - nav.weekStart.getTime()) / DAY_MS) : -1);
  } else if (period === "month") {
    labels = Array.from({ length: new Date(nav.year, nav.month, 0).getDate() }, (_, i) => String(i + 1));
    bucketOf = (d) => (d.getFullYear() === nav.year && d.getMonth() === nav.month - 1 ? d.getDate() - 1 : -1);
  } else {
    labels = MONTH_KEYS.map((k) => t(`calendar.months.${k}`).slice(0, 3));
    bucketOf = (d) => (d.getFullYear() === nav.year ? d.getMonth() : -1);
  }
  const values = labels.map(() => 0);
  for (const tx of expenses) {
    const bucket = bucketOf(tx.date);
    if (bucket >= 0) values[bucket] += tx.amount;
  }

  const periodButtons = (
    <div className="flex gap-1">
      {(["week", "month", "year"] as const).map((p) => (
        <button
          key={p}
          onClick={() => setPeriod(p)}
          className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
            period === p ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {t(`dashboard.period${p.charAt(0).toUpperCase() + p.slice(1)}` as "dashboard.periodWeek")}
        </button>
      ))}
    </div>
  );

  const titleKey = { week: "dashboard.expenseWeekly", month: "dashboard.expenseMonthly", year: "dashboard.expenseYearly" } as const;
  const maxTicksLimit = period === "week" ? 7 : period === "month" ? (isMobile ? 8 : 15) : isMobile ? 6 : 12;

  return (
    <DashboardCard title={t(titleKey[period])} action={periodButtons} nav={nav} loading={isLoading}>
      <div className="dashboard-chart w-full">
        <Bar
          data={{ labels, datasets: [{ data: values.map((v) => Math.round(v * 100) / 100), backgroundColor: colors.danger, borderRadius: 4 }] }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              tooltip: { ...tooltipConfig(), callbacks: { label: (ctx) => formatCurrency(ctx.parsed.y ?? 0) } },
              legend: { display: false },
            },
            scales: {
              x: axisConfig({ maxTicksLimit, font: { size: period === "month" ? 8 : 10 } }),
              y: axisConfig({ callback: formatK }),
            },
          }}
        />
      </div>
    </DashboardCard>
  );
}
