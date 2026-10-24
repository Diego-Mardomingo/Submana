"use client";

import { Chart, Line } from "react-chartjs-2";
import type { Chart as ChartJS, ScriptableContext } from "chart.js";
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

const signedK = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${formatK(Math.abs(Math.round(v)))}`;
const signedCurrency = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${formatCurrency(Math.abs(v))}`;

/** Income and expense bars per month; `showBalance` adds the net line and the net under each month. */
export function IncomeExpenseBars({
  labels,
  income,
  expense,
  es,
  showBalance = false,
}: {
  labels: string[];
  income: number[];
  expense: number[];
  es: boolean;
  showBalance?: boolean;
}) {
  const { colors } = useChartTheme();
  const bar = { borderRadius: 4, borderSkipped: false, maxBarThickness: 18, categoryPercentage: 0.7, barPercentage: 0.9 } as const;
  const balance = income.map((v, i) => v - expense[i]);
  const balanceLabel = es ? "Balance" : "Net";

  // Net amount written under each month label (colour-coded), drawn in the bottom padding.
  const balanceTexts = {
    id: "balanceTexts",
    afterDraw(chart: ChartJS) {
      if (!showBalance) return;
      const { ctx, scales } = chart;
      const x = scales.x;
      ctx.save();
      ctx.font = "600 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      balance.forEach((v, i) => {
        ctx.fillStyle = v > 0 ? colors.success : v < 0 ? colors.danger : colors.muted;
        ctx.fillText(signedK(v), x.getPixelForTick(i), x.bottom + 2);
      });
      ctx.restore();
    },
  };

  return (
    <Chart
      type="bar"
      plugins={[balanceTexts]}
      data={{
        labels,
        datasets: [
          { type: "bar" as const, label: es ? "Ingresos" : "Income", data: income, backgroundColor: colors.success, ...bar },
          { type: "bar" as const, label: es ? "Gastos" : "Expenses", data: expense, backgroundColor: colors.danger, ...bar },
          ...(showBalance
            ? [
                {
                  type: "line" as const,
                  label: balanceLabel,
                  data: balance,
                  borderColor: colors.foreground,
                  backgroundColor: colors.foreground,
                  borderWidth: 2,
                  tension: 0.3,
                  cubicInterpolationMode: "monotone" as const,
                  pointRadius: 3,
                  pointHoverRadius: 5,
                  order: -1,
                },
              ]
            : []),
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        layout: { padding: { bottom: showBalance ? 14 : 0 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipConfig(),
            callbacks: {
              label: (ctx) => {
                const value = ctx.parsed.y ?? 0;
                return `${ctx.dataset.label}: ${ctx.dataset.type === "line" ? signedCurrency(value) : formatCurrency(value)}`;
              },
            },
          },
        },
        scales: { x: xAxis(), y: yAxis() },
      }}
    />
  );
}
