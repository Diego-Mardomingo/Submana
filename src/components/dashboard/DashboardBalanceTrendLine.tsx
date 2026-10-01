"use client";

import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { DashboardCard, EmptyState } from "@/components/dashboard/DashboardCard";
import { MonthRangePicker } from "@/components/dashboard/MonthRangePicker";
import { useBalanceTrendRange } from "@/contexts/BalanceTrendRangeContext";
import { useLang } from "@/hooks/useLang";
import { useTransactionsRange, type DateRange } from "@/hooks/useTransactions";
import { axisConfig, formatK, tooltipConfig, useChartTheme } from "@/lib/chartConfig";
import { formatCurrency, monthKeyLabel } from "@/lib/format";
import { netBalanceChange, runningTotals } from "@/lib/metricsFilters";

/**
 * Month-end balance history, rebuilt backwards from the current balance. Without `accountId`
 * it covers every account. All trend charts share the widest available range by default.
 */
export default function DashboardBalanceTrendLine(props: {
  title: React.ReactNode;
  balance: number;
  accountId?: string;
  color?: string | null;
}) {
  const { title, balance, accountId } = props;
  const lang = useLang();
  const { colors } = useChartTheme();
  const color = props.color || colors.accent;
  const { sharedRange, registerAvailableRange } = useBalanceTrendRange();
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const range = customRange ?? sharedRange ?? undefined;
  const { byMonth, allKeys, keys, availableRange, isLoading } = useTransactionsRange(accountId, range);

  useEffect(() => {
    if (availableRange) registerAvailableRange(accountId ?? "__total__", availableRange);
  }, [availableRange, registerAvailableRange, accountId]);

  // Balance before the first visible month = current balance minus every later change.
  const firstKey = keys[0] ?? "";
  const netOf = (key: string) => netBalanceChange(byMonth.get(key) ?? []);
  const startBalance = balance - allKeys.filter((key) => key >= firstKey).reduce((sum, key) => sum + netOf(key), 0);
  const points = runningTotals(keys.map(netOf), startBalance);

  return (
    <DashboardCard
      title={title}
      action={
        !isLoading && (
          <MonthRangePicker
            shown={range ?? null}
            available={availableRange}
            isCustom={!!customRange}
            onChange={setCustomRange}
            monthCount={keys.length}
          />
        )
      }
      loading={isLoading}
    >
      {points.length === 0 ? (
        <EmptyState>{lang === "es" ? "Sin transacciones" : "No transactions"}</EmptyState>
      ) : (
        <div className="dashboard-chart-tall w-full">
          <Line
            data={{
              labels: keys.map((key) => monthKeyLabel(key, lang)),
              datasets: [
                {
                  data: points,
                  borderColor: color,
                  backgroundColor: color + "20",
                  borderWidth: 2,
                  pointBackgroundColor: color,
                  pointRadius: 3,
                  pointHoverRadius: 6,
                  fill: true,
                  tension: 0.3,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: "index", intersect: false },
              plugins: {
                tooltip: { ...tooltipConfig(), callbacks: { label: (ctx) => formatCurrency(ctx.parsed.y ?? 0) } },
                legend: { display: false },
              },
              scales: { x: axisConfig({ font: { size: 11 } }), y: axisConfig({ callback: formatK }) },
            }}
          />
        </div>
      )}
    </DashboardCard>
  );
}
