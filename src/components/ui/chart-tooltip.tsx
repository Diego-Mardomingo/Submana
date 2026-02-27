"use client";

import { Tooltip } from "recharts";
import type { ComponentProps } from "react";

export const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "var(--blanco)",
  },
  labelStyle: { color: "var(--blanco)", fontWeight: 600 },
  itemStyle: { color: "var(--blanco)" },
};

export type ChartTooltipProps = ComponentProps<typeof Tooltip>;

export { Tooltip as ChartTooltip };
