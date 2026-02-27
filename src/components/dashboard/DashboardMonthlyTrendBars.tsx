"use client";

import { useMemo, useState } from "react";
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
import { chartTooltipStyle } from "@/components/ui/chart-tooltip";
import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { useChartTooltipControl } from "@/hooks/useChartTooltipControl";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Spinner } from "@/components/ui/spinner";
import { Settings2 } from "lucide-react";
import { ChartMobileHint } from "./ChartMobileHint";

type Tx = { amount?: number; type?: string };

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function DashboardMonthlyTrendBars() {
  const lang = useLang();
  const t = useTranslations(lang);
  const months = lang === "es" ? MONTHS_ES : MONTHS_EN;
  
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  
  const { transactionsByMonth, monthLabels, availableRange, isLoading } = useTransactionsRange(
    undefined,
    customRange ?? undefined
  );
  const { containerRef, isTouch } = useChartTooltipControl();
  
  // Estado temporal para el selector
  const [tempStart, setTempStart] = useState<{ year: number; month: number } | null>(null);
  const [tempEnd, setTempEnd] = useState<{ year: number; month: number } | null>(null);
  
  // Inicializar valores temporales al abrir el popover
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
        startYear: tempStart.year,
        startMonth: tempStart.month,
        endYear: tempEnd.year,
        endMonth: tempEnd.month,
      });
    }
    setPopoverOpen(false);
  };
  
  const handleResetRange = () => {
    setCustomRange(null);
    setPopoverOpen(false);
  };
  
  // Generar años disponibles
  const availableYears = useMemo(() => {
    if (!availableRange) return [];
    const years: number[] = [];
    for (let y = availableRange.startYear; y <= availableRange.endYear; y++) {
      years.push(y);
    }
    return years;
  }, [availableRange]);

  const chartData = useMemo(() => {
    return monthLabels.map(({ key, label }) => {
      const txs = (transactionsByMonth[key] ?? []) as Tx[];
      let income = 0;
      let expense = 0;
      for (const tx of txs) {
        const amt = Number(tx.amount) || 0;
        if (tx.type === "income") income += amt;
        else expense += amt;
      }
      return { name: label, income, expense };
    });
  }, [transactionsByMonth, monthLabels]);

  const rangeSelectorContent = availableRange && tempStart && tempEnd && (
    <div className="space-y-4">
      {/* Desde */}
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

      {/* Hasta */}
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

      {/* Botones de acción */}
      <div className="flex gap-2 justify-end pt-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetRange}
        >
          {lang === "es" ? "Restablecer" : "Reset"}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleApplyRange}
        >
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
        <div className="dashboard-chart-tall w-full" ref={containerRef}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 4, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={45} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
              <Tooltip
                trigger={isTouch ? "click" : "hover"}
                formatter={(value: number) => [formatCurrency(value), ""]}
                labelFormatter={(label) => label}
                {...chartTooltipStyle}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="income" fill="var(--success)" name={lang === "es" ? "Ingresos" : "Income"} radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" fill="var(--danger)" name={lang === "es" ? "Gastos" : "Expense"} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {isTouch && <ChartMobileHint type="tap" />}
      </CardContent>
    </Card>
  );
}
