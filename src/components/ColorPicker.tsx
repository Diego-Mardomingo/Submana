"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Palette shared by accounts and budgets: medium saturation, readable on light and dark themes. */
export const PALETTE = [
  "#a78bfa", "#6366f1", "#60a5fa", "#22d3ee", "#2dd4bf", "#34d399",
  "#fbbf24", "#fb923c", "#e879f9", "#f87171", "#ec4899", "#84cc16",
] as const;

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="size-10 rounded-lg cursor-pointer border border-input" style={{ backgroundColor: value }} />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start" side="top">
        <div className="grid grid-cols-4 gap-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className="size-6 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              style={{ backgroundColor: c, border: value === c ? "2px solid var(--blanco)" : "none" }}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
