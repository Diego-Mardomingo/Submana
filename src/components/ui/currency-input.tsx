"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value: string;
  onChange: (value: string) => void;
  currency?: string;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, currency = "€", ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = e.target.value;
      
      newValue = newValue.replace(/[^0-9.,]/g, "");
      
      const commaCount = (newValue.match(/,/g) || []).length;
      const dotCount = (newValue.match(/\./g) || []).length;
      
      if (commaCount > 1 || dotCount > 1 || (commaCount > 0 && dotCount > 0)) {
        return;
      }
      
      onChange(newValue);
    };

    const handleBlur = () => {
      if (!value) return;
      
      const normalizedValue = value.replace(",", ".");
      const num = parseFloat(normalizedValue);
      
      if (!isNaN(num)) {
        onChange(num.toFixed(2).replace(".", ","));
      }
    };

    return (
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm pr-8",
            className
          )}
          ref={ref}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          {...props}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          {currency}
        </span>
      </div>
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

export function parseCurrencyValue(value: string): number {
  if (!value) return 0;
  const normalized = value.replace(",", ".");
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
}

export { CurrencyInput };
