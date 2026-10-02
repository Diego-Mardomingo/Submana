"use client";

import { Bar, Line } from "react-chartjs-2";
import type { ScriptableContext } from "chart.js";
import { axisConfig, formatK, tooltipConfig, useChartTheme } from "@/lib/chartConfig";
import { formatCurrency } from "@/lib/format";

/** `#rrggbb` plus alpha (00-ff), or `fallback` for any other colour format. */
const withAlpha = (color: string, alpha: string, fallback = "transparent") => (/^#[0-9a-f]{6}$/i.test(color) ? color + alpha : fallback);

const xAxis = () => ({ ...axisConfig({ maxRotation: 0, autoSkipPadding: 12 }), grid: { display: false } });
const yAxis = () => axisConfig({ callback: formatK, maxTicksLimit: 5 });

/** Area line of month-end balances; `color` defaults to the accent. */
export function BalanceLine({ labels, points, color }: { labels: string[]; points: number[]; color?: string | null }) {
  const { colors } = useChartTheme();
  const stroke = color || colors.accent;
  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            data: points,
            borderColor: stroke,
            borderWidth: 2.5,
            backgroundColor: ({ chart }: ScriptableContext<"line">) => {
              if (!chart.chartArea) return "transparent";
              const gradient = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom);
              gradient.addColorStop(0, withAlpha(stroke, "45"));
              gradient.addColorStop(1, withAlpha(stroke, "00"));
              return gradient;
            },
            fill: true,
            tension: 0.35,
            cubicInterpolationMode: "monotone",
            pointRadius: points.length === 1 ? 4 : 0,
            pointHoverRadius: 5,
            pointHitRadius: 16,
            pointBackgroundColor: stroke,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltipConfig(), displayColors: false, callbacks: { label: (ctx) => formatCurrency(ctx.parsed.y ?? 0) } },
        },
        scales: { x: xAxis(), y: yAxis() },
      }}
    />
  );
}

/** Income and expense bars per month. */
export function IncomeExpenseBars({ labels, income, expense, es }: { labels: string[]; income: number[]; expense: number[]; es: boolean }) {
  const { colors } = useChartTheme();
  const bar = { borderRadius: 4, borderSkipped: false, maxBarThickness: 18, categoryPercentage: 0.7, barPercentage: 0.9 } as const;
  return (
    <Bar
      data={{
        labels,
        datasets: [
          { label: es ? "Ingresos" : "Income", data: income, backgroundColor: colors.success, ...bar },
          { label: es ? "Gastos" : "Expenses", data: expense, backgroundColor: colors.danger, ...bar },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltipConfig(), callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}` } },
        },
        scales: { x: xAxis(), y: yAxis() },
      }}
    />
  );
}
