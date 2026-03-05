"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
);

if (typeof window !== "undefined") {
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (isTouch) {
    ChartJS.defaults.events = ["click"];
  }

  ChartJS.register({
    id: "dismissOnScroll",
    beforeInit(chart: ChartJS) {
      const handler = () => {
        const tooltip = chart.tooltip;
        if (tooltip && tooltip.getActiveElements().length) {
          tooltip.setActiveElements([], { x: 0, y: 0 });
          chart.update("none");
        }
      };
      window.addEventListener("scroll", handler, { passive: true, capture: true });
      const origDestroy = chart.destroy.bind(chart);
      chart.destroy = () => {
        window.removeEventListener("scroll", handler, { capture: true });
        origDestroy();
      };
    },
  });
}

function getCSSVar(name: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function getChartColors() {
  return {
    accent: getCSSVar("--accent"),
    success: getCSSVar("--success"),
    danger: getCSSVar("--danger"),
    info: getCSSVar("--info"),
    warning: getCSSVar("--warning"),
    teal: getCSSVar("--teal"),
    muted: getCSSVar("--muted-foreground"),
    border: getCSSVar("--border"),
    card: getCSSVar("--card"),
    foreground: getCSSVar("--blanco"),
  };
}

export const CHART_PALETTE = [
  "var(--accent)",
  "var(--success)",
  "var(--info)",
  "var(--warning)",
  "var(--teal)",
  "var(--danger)",
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
];

export function resolveChartPalette(): string[] {
  if (typeof document === "undefined") return CHART_PALETTE;
  const style = getComputedStyle(document.documentElement);
  return CHART_PALETTE.map((c) => {
    if (c.startsWith("var(--")) {
      const varName = c.slice(4, -1);
      return style.getPropertyValue(varName).trim() || c;
    }
    return c;
  });
}

export function tooltipConfig() {
  const colors = getChartColors();
  return {
    backgroundColor: colors.card || "#1a1a2e",
    titleColor: colors.foreground || "#fff",
    bodyColor: colors.foreground || "#fff",
    borderColor: colors.border || "#333",
    borderWidth: 1,
    cornerRadius: 8,
    padding: 10,
    bodyFont: { size: 12 },
    titleFont: { size: 12, weight: "bold" as const },
    displayColors: true,
    boxPadding: 4,
  };
}

export function gridConfig() {
  const colors = getChartColors();
  return {
    color: colors.border ? `${colors.border}50` : "rgba(255,255,255,0.08)",
  };
}

export function axisConfig() {
  const colors = getChartColors();
  return {
    ticks: {
      color: colors.muted || "#888",
      font: { size: 10 },
    },
    grid: gridConfig(),
    border: { display: false },
  };
}

export function formatK(v: number | string): string {
  const n = Number(v);
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(n);
}
