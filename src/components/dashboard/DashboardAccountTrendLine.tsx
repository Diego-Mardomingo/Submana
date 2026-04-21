"use client";

import { useMemo, useState, useEffect, useRef } from "react";
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
import { useLang } from "@/hooks/useLang";
import { Line } from "react-chartjs-2";
import { Spinner } from "@/components/ui/spinner";
import { Settings2 } from "lucide-react";
import { tooltipConfig, axisConfig, gridConfig, formatK } from "@/lib/chartConfig";
import { filterForMetrics } from "@/lib/metricsFilters";
import { useCategories } from "@/hooks/useCategories";
import { useBalanceTrendRange } from "@/contexts/BalanceTrendRangeContext";
import { detectTransferIds } from "@/lib/transferDetection";

type Tx = { id?: string; amount?: number; type?: string; date?: string; account_id?: string; category_id?: string | null; subcategory_id?: string | null };

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Props {
  accountId: string;
  accountName: string;
  accountColor: string;
  accountBalance: number;
}

export default function DashboardAccountTrendLine({ accountId, accountName, accountColor, accountBalance }: Props) {
  const lang = useLang();
  const months = lang === "es" ? MONTHS_ES : MONTHS_EN;
  const colorRef = useRef(accountColor);
  const { sharedRange, registerAvailableRange } = useBalanceTrendRange();

  useEffect(() => {
    colorRef.current = accountColor;
  }, [accountColor]);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [customRange, setCustomRange] = useState<DateRange | null>(null);

  const effectiveRange = customRange ?? sharedRange ?? undefined;

  const { transactionsByMonth, monthLabels, availableRange, allByMonth, allKeys, isLoading } = useTransactionsRange(
    accountId,
    effectiveRange
  );
  const { allByMonth: allAccountsByMonth, allKeys: allAccountKeys } = useTransactionsRange(
    undefined,
    effectiveRange
  );
  const { data: categoriesData } = useCategories();

  useEffect(() => {
    if (availableRange) registerAvailableRange(accountId, availableRange);
  }, [availableRange, registerAvailableRange, accountId]);

  const [tempStart, setTempStart] = useState<{ year: number; month: number } | null>(null);
  const [tempEnd, setTempEnd] = useState<{ year: number; month: number } | null>(null);

  const handlePopoverOpenChange = (open: boolean) => {
    if (open && availableRange) {
      setTempStart(customRange
        ? { year: customRange.startYear, month: customRange.startMonth }
        : { year: availableRange.startYear, month: availableRange.startMonth }
      );
      setTempEnd(customRange
        ? { year: customRange.endYear, month: customRange.endMonth }
        : { year: availableRange.endYear, month: availableRange.endMonth }
      );
    }
    setPopoverOpen(open);
  };

  const handleApplyRange = () => {
    if (tempStart && tempEnd) {
      setCustomRange({
        startYear: tempStart.year, startMonth: tempStart.month,
        endYear: tempEnd.year, endMonth: tempEnd.month,
      });
    }
    setPopoverOpen(false);
  };

  const handleResetRange = () => {
    setCustomRange(null);
    setPopoverOpen(false);
  };

  const availableYears = useMemo(() => {
    if (!availableRange) return [];
    const years: number[] = [];
    for (let y = availableRange.startYear; y <= availableRange.endYear; y++) years.push(y);
    return years;
  }, [availableRange]);

  const chartData = useMemo(() => {
    const ctx = {
      defaultCategories: categoriesData?.defaultCategories ?? [],
      userCategories: categoriesData?.userCategories ?? [],
    };

    const allTxForTransferDetection = allAccountKeys.flatMap(
      (key) => (allAccountsByMonth[key] ?? []) as Tx[]
    );
    const transferIds = detectTransferIds(
      allTxForTransferDetection.map((tx) => ({
        id: tx.id ?? "",
        amount: Number(tx.amount) || 0,
        type: tx.type || "",
        date: tx.date || "",
        account_id: tx.account_id,
      }))
    );

    let netAllTransactions = 0;
    for (const key of allKeys) {
      const txs = (allByMonth[key] ?? []) as Tx[];
      const forMetrics = filterForMetrics(
        txs.filter((tx) => !transferIds.has(tx.id ?? "")),
        ctx
      );
      for (const tx of forMetrics) {
        const amt = Number(tx.amount) || 0;
        if (tx.type === "income") netAllTransactions += amt;
        else netAllTransactions -= amt;
      }
    }

    const balanceBeforeAllTx = accountBalance - netAllTransactions;

    const firstVisibleKey = monthLabels.length > 0 ? monthLabels[0].key : null;
    let preRangeBalance = balanceBeforeAllTx;
    if (firstVisibleKey) {
      for (const key of allKeys) {
        if (key >= firstVisibleKey) break;
        const txs = (allByMonth[key] ?? []) as Tx[];
        const forMetrics = filterForMetrics(
          txs.filter((tx) => !transferIds.has(tx.id ?? "")),
          ctx
        );
        for (const tx of forMetrics) {
          const amt = Number(tx.amount) || 0;
          if (tx.type === "income") preRangeBalance += amt;
          else preRangeBalance -= amt;
        }
      }
    }

    let cumulative = preRangeBalance;
    return monthLabels.map(({ key, label }) => {
      const txs = (transactionsByMonth[key] ?? []) as Tx[];
      const forMetrics = filterForMetrics(
        txs.filter((tx) => !transferIds.has(tx.id ?? "")),
        ctx
      );
      for (const tx of forMetrics) {
        const amt = Number(tx.amount) || 0;
        if (tx.type === "income") cumulative += amt;
        else cumulative -= amt;
      }
      return { name: label, balance: Math.round(cumulative * 100) / 100 };
    });
  }, [
    transactionsByMonth,
    monthLabels,
    accountBalance,
    allByMonth,
    allKeys,
    categoriesData,
    allAccountsByMonth,
    allAccountKeys,
  ]);

  const color = colorRef.current || "#6366f1";

  const lineData = useMemo(() => ({
    labels: chartData.map((d) => d.name),
    datasets: [{
      data: chartData.map((d) => d.balance),
      borderColor: color,
      backgroundColor: color + "20",
      borderWidth: 2,
      pointBackgroundColor: color,
      pointRadius: 3,
      pointHoverRadius: 6,
      fill: true,
      tension: 0.3,
    }],
  }), [chartData, color]);

  const lineOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      tooltip: {
        ...tooltipConfig(),
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) => formatCurrency(ctx.parsed.y ?? 0),
        },
      },
      legend: { display: false },
      annotation: undefined,
    },
    scales: {
      x: { ...axisConfig(), ticks: { ...axisConfig().ticks, font: { size: 11 } } },
      y: {
        ...axisConfig(),
        grid: gridConfig(),
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
          <Select value={String(tempStart.month)} onValueChange={(v) => setTempStart({ ...tempStart, month: Number(v) })}>
            <SelectTrigger size="sm" className="flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(tempStart.year)} onValueChange={(v) => setTempStart({ ...tempStart, year: Number(v) })}>
            <SelectTrigger size="sm" className="w-[5.5rem]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          {lang === "es" ? "Hasta" : "To"}
        </label>
        <div className="flex gap-2">
          <Select value={String(tempEnd.month)} onValueChange={(v) => setTempEnd({ ...tempEnd, month: Number(v) })}>
            <SelectTrigger size="sm" className="flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(tempEnd.year)} onValueChange={(v) => setTempEnd({ ...tempEnd, year: Number(v) })}>
            <SelectTrigger size="sm" className="w-[5.5rem]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
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

  const titleContent = (
    <CardTitle className="flex items-center gap-2 text-base font-semibold text-muted-foreground">
      <span className="inline-block size-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {accountName}
    </CardTitle>
  );

  if (isLoading) {
    return (
      <Card className="dashboard-card">
        <CardHeader>{titleContent}</CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="size-6 text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="dashboard-card">
        <CardHeader>{titleContent}</CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            {lang === "es" ? "Sin transacciones" : "No transactions"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dashboard-card">
      <CardHeader>
        {titleContent}
        <CardAction>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {monthLabels.length} {lang === "es" ? "meses" : "months"}
            </span>
            <Popover open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  variant={customRange || popoverOpen ? "secondary" : "ghost"}
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
          <Line data={lineData} options={lineOptions} />
        </div>
      </CardContent>
    </Card>
  );
}
