"use client";

import { useMemo, useState, useEffect } from "react";
import { useTransactionsRange, type DateRange } from "@/hooks/useTransactionsRange";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { Bar } from "react-chartjs-2";
import { Spinner } from "@/components/ui/spinner";
import { Settings2 } from "lucide-react";
import { tooltipConfig, axisConfig, gridConfig, formatK, getChartColors } from "@/lib/chartConfig";
import { detectTransferIds } from "@/lib/transferDetection";
import { filterForMetrics } from "@/lib/metricsFilters";
import { useCategories } from "@/hooks/useCategories";

type Tx = { id: string; amount?: number; type?: string; date?: string; account_id?: string; category_id?: string | null; subcategory_id?: string | null };

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function DashboardMonthlyTrendBars() {
  const lang = useLang();
  const t = useTranslations(lang);
  const months = lang === "es" ? MONTHS_ES : MONTHS_EN;
  const [chartColors, setChartColors] = useState({ success: "#10b981", danger: "#ef4444" });
  useEffect(() => {
    const c = getChartColors();
    setChartColors({
      success: c.success || "#10b981",
      danger: c.danger || "#ef4444",
    });
  }, []);

  const [popoverOpen, setPopoverOpen] = useState(false);

  const now = new Date();
  const defaultEndYear = now.getFullYear();
  const defaultEndMonth = now.getMonth() + 1;
  const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const defaultStartYear = startDate.getFullYear();
  const defaultStartMonth = startDate.getMonth() + 1;

  const [customRange, setCustomRange] = useState<DateRange>({
    startYear: defaultStartYear,
    startMonth: defaultStartMonth,
    endYear: defaultEndYear,
    endMonth: defaultEndMonth,
  });

  const { transactionsByMonth, monthLabels, availableRange, isLoading } = useTransactionsRange(
    undefined,
    customRange
  );
  const { data: categoriesData } = useCategories();

  const [tempStart, setTempStart] = useState<{ year: number; month: number } | null>(null);
  const [tempEnd, setTempEnd] = useState<{ year: number; month: number } | null>(null);

  const handlePopoverOpenChange = (open: boolean) => {
    if (open) {
      setTempStart({ year: customRange.startYear, month: customRange.startMonth });
      setTempEnd({ year: customRange.endYear, month: customRange.endMonth });
    }
    setPopoverOpen(open);
  };

  const handleApplyRange = () => {
    if (tempStart && tempEnd) {
      setCustomRange({
        startYear: tempStart.year,
        startMonth: tempStart.month,
        endYear: tempEnd.year,
        endMonth: tempEnd.month,
      });
    }
    setPopoverOpen(false);
  };

  const handleResetRange = () => {
    setCustomRange({
      startYear: defaultStartYear,
      startMonth: defaultStartMonth,
      endYear: defaultEndYear,
      endMonth: defaultEndMonth,
    });
    setPopoverOpen(false);
  };

  const availableYears = useMemo(() => {
    if (!availableRange) return [];
    const years: number[] = [];
    for (let y = availableRange.startYear; y <= availableRange.endYear; y++) {
      years.push(y);
    }
    return years;
  }, [availableRange]);

  const chartData = useMemo(() => {
    const ctx = {
      defaultCategories: categoriesData?.defaultCategories ?? [],
      userCategories: categoriesData?.userCategories ?? [],
    };
    return monthLabels.map(({ key, label }) => {
      const txs = (transactionsByMonth[key] ?? []) as Tx[];
      const transferIds = detectTransferIds(txs.map((tx) => ({ id: tx.id, amount: Number(tx.amount) || 0, type: tx.type || "", date: tx.date || "", account_id: tx.account_id })));
      const forMetrics = filterForMetrics(txs.filter((tx) => !transferIds.has(tx.id)), ctx);
      let income = 0;
      let expense = 0;
      for (const tx of forMetrics) {
        const amt = Number(tx.amount) || 0;
        if (tx.type === "income") income += amt;
        else expense += amt;
      }
      return { name: label, income, expense };
    });
  }, [transactionsByMonth, monthLabels, categoriesData]);

  const barData = useMemo(() => ({
    labels: chartData.map((d) => d.name),
    datasets: [
      {
        label: lang === "es" ? "Ingresos" : "Income",
        data: chartData.map((d) => d.income),
        backgroundColor: chartColors.success,
        borderRadius: 4,
      },
      {
        label: lang === "es" ? "Gastos" : "Expense",
        data: chartData.map((d) => d.expense),
        backgroundColor: chartColors.danger,
        borderRadius: 4,
      },
    ],
  }), [chartData, lang, chartColors]);

  const barOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      tooltip: {
        ...tooltipConfig(),
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
            `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}`,
        },
      },
      legend: {
        labels: { font: { size: 12 }, usePointStyle: true, pointStyle: "rectRounded" },
      },
    },
    scales: {
      x: { ...axisConfig() },
      y: {
        ...axisConfig(),
        ticks: { ...axisConfig().ticks, callback: formatK },
      },
    },
  }), []);

  const rangeSelectorContent = availableRange && tempStart && tempEnd && (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          {lang === "es" ? "Desde" : "From"}
        </label>
        <div className="flex gap-2">
          <Select
            value={String(tempStart.month)}
            onValueChange={(value) => setTempStart({ ...tempStart, month: Number(value) })}
          >
            <SelectTrigger size="sm" className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(tempStart.year)}
            onValueChange={(value) => setTempStart({ ...tempStart, year: Number(value) })}
          >
            <SelectTrigger size="sm" className="w-[5.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          {lang === "es" ? "Hasta" : "To"}
        </label>
        <div className="flex gap-2">
          <Select
            value={String(tempEnd.month)}
            onValueChange={(value) => setTempEnd({ ...tempEnd, month: Number(value) })}
          >
            <SelectTrigger size="sm" className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(tempEnd.year)}
            onValueChange={(value) => setTempEnd({ ...tempEnd, year: Number(value) })}
          >
            <SelectTrigger size="sm" className="w-[5.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2 border-t">
        <Button variant="ghost" size="sm" onClick={handleResetRange}>
          {lang === "es" ? "Restablecer" : "Reset"}
        </Button>
        <Button variant="default" size="sm" onClick={handleApplyRange}>
          {lang === "es" ? "Aplicar" : "Apply"}
        </Button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-muted-foreground">
            {t("dashboard.incomeVsExpense")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="size-6 text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-muted-foreground">
          {t("dashboard.incomeVsExpense")}
        </CardTitle>
        <CardAction>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {monthLabels.length} {lang === "es" ? "meses" : "months"}
            </span>
            <Popover open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  variant={popoverOpen ? "secondary" : "ghost"}
                  size="icon-xs"
                  title={lang === "es" ? "Configurar rango" : "Configure range"}
                >
                  <Settings2 className="size-4" strokeWidth={1.5} />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <div className="mb-3">
                  <h4 className="font-medium text-sm">
                    {lang === "es" ? "Rango de fechas" : "Date range"}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {lang === "es" ? "Selecciona el período a mostrar" : "Select the period to display"}
                  </p>
                </div>
                {rangeSelectorContent}
              </PopoverContent>
            </Popover>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="dashboard-chart-tall w-full">
          <Bar data={barData} options={barOptions} />
        </div>
      </CardContent>
    </Card>
  );
}
