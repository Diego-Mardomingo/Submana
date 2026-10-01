"use client";

import { useSyncExternalStore } from "react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Filler, Tooltip, Legend);

if (typeof window !== "undefined") {
  // On touch devices tooltips open on tap only, and any scroll dismisses them.
  if ("ontouchstart" in window || navigator.maxTouchPoints > 0) ChartJS.defaults.events = ["click"];
  ChartJS.register({
    id: "dismissOnScroll",
    beforeInit(chart: ChartJS) {
      const handler = () => {
        if (!chart.tooltip?.getActiveElements().length) return;
        chart.tooltip.setActiveElements([], { x: 0, y: 0 });
        chart.update("none");
      };
      window.addEventListener("scroll", handler, { passive: true, capture: true });
      const destroy = chart.destroy.bind(chart);
      chart.destroy = () => {
        window.removeEventListener("scroll", handler, { capture: true });
        destroy();
      };
    },
  });
}

const COLOR_VARS = {
  accent: ["--accent", "#6366f1"],
  success: ["--success", "#10b981"],
  danger: ["--danger", "#ef4444"],
  info: ["--info", "#3b82f6"],
  warning: ["--warning", "#f59e0b"],
  teal: ["--teal", "#14b8a6"],
  muted: ["--muted-foreground", "#888"],
  border: ["--border", "#333333"],
  card: ["--card", "#1a1a2e"],
  foreground: ["--blanco", "#fff"],
} as const;

type ChartColors = Record<keyof typeof COLOR_VARS, string>;

/** Theme colours resolved from CSS variables (fallbacks when unavailable, e.g. during SSR). */
function getChartColors(): ChartColors {
  const style = typeof document === "undefined" ? null : getComputedStyle(document.documentElement);
  return Object.fromEntries(
    Object.entries(COLOR_VARS).map(([key, [cssVar, fallback]]) => [key, style?.getPropertyValue(cssVar).trim() || fallback])
  ) as ChartColors;
}

const PALETTE_EXTRA = [
  "#ec4899", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16", "#14b8a6", "#6366f1",
  "#e11d48", "#0ea5e9", "#a855f7", "#f43f5e", "#22d3ee", "#4ade80", "#fb923c",
];

function buildTheme(theme: string | null) {
  const colors = getChartColors();
  const { accent, success, info, warning, teal, danger } = colors;
  return { theme, colors, palette: [accent, success, info, warning, teal, danger, ...PALETTE_EXTRA] };
}

const SERVER_THEME = buildTheme(null);
let cached: ReturnType<typeof buildTheme> | undefined;

function readTheme() {
  const theme = document.documentElement.getAttribute("data-theme");
  if (cached?.theme !== theme) cached = buildTheme(theme);
  return cached;
}

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** Chart colours and categorical palette for the current theme (re-renders on theme change). */
export function useChartTheme() {
  return useSyncExternalStore(subscribeTheme, readTheme, () => SERVER_THEME);
}

export function tooltipConfig() {
  const { card, foreground, border } = getChartColors();
  return {
    backgroundColor: card,
    titleColor: foreground,
    bodyColor: foreground,
    borderColor: border,
    borderWidth: 1,
    cornerRadius: 8,
    padding: 10,
    bodyFont: { size: 12 },
    titleFont: { size: 12, weight: "bold" as const },
    displayColors: true,
    boxPadding: 4,
  };
}

/** Axis styling; `ticks` overrides are merged into the default tick style. */
export function axisConfig(ticks: Record<string, unknown> = {}) {
  const { muted, border } = getChartColors();
  return {
    ticks: { color: muted, font: { size: 10 }, ...ticks },
    grid: { color: `${border}50` },
    border: { display: false },
  };
}

export function formatK(v: number | string): string {
  const n = Number(v);
  return Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);
}
