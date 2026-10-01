"use client";

import { cn } from "@/lib/utils";

/** "1234,5" / "1234.5" → 1234.5 (0 when empty or invalid). */
export function parseCurrencyValue(value: string): number {
  const num = parseFloat((value || "").replace(",", "."));
  return isNaN(num) ? 0 : num;
}

/** Euro amount field: accepts one decimal separator and normalises to "0,00" on blur. */
export function CurrencyInput({ className, value, onChange, ...props }: Omit<React.ComponentProps<"input">, "onChange" | "value" | "type"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm pr-8",
          className
        )}
        value={value}
        onChange={(e) => {
          const next = e.target.value.replace(/[^0-9.,]/g, "");
          const commas = next.split(",").length - 1;
          const dots = next.split(".").length - 1;
          if (commas + dots <= 1) onChange(next);
        }}
        onBlur={() => value && !isNaN(parseFloat(value.replace(",", "."))) && onChange(parseCurrencyValue(value).toFixed(2).replace(".", ","))}
        {...props}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">€</span>
    </div>
  );
}
