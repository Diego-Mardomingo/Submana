"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLang } from "@/hooks/useLang";
import type { DateRange } from "@/hooks/useTransactions";
import { monthName } from "@/lib/format";

type YearMonth = { year: number; month: number };

/**
 * Month-range popover for trend charts. `shown` is the range currently displayed, `available`
 * bounds the selectable years and `onChange(null)` resets to the chart's default range.
 */
export function MonthRangePicker(props: {
  shown: DateRange | null;
  available: DateRange | null;
  isCustom: boolean;
  onChange: (range: DateRange | null) => void;
  monthCount: number;
}) {
  const { shown, available, isCustom, onChange, monthCount } = props;
  const es = useLang() === "es";
  const [draft, setDraft] = useState<{ start: YearMonth; end: YearMonth } | null>(null);

  const open = (isOpen: boolean) => {
    const range = shown ?? available;
    setDraft(
      isOpen && range
        ? { start: { year: range.startYear, month: range.startMonth }, end: { year: range.endYear, month: range.endMonth } }
        : null
    );
  };
  const close = (range: DateRange | null) => {
    onChange(range);
    setDraft(null);
  };

  const years = available
    ? Array.from({ length: available.endYear - available.startYear + 1 }, (_, i) => available.startYear + i)
    : [];
  const picker = (label: string, edge: "start" | "end") => {
    if (!draft) return null;
    const value = draft[edge];
    const set = (patch: Partial<YearMonth>) => setDraft({ ...draft, [edge]: { ...value, ...patch } });
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">{label}</label>
        <div className="flex gap-2">
          <Select value={String(value.month)} onValueChange={(v) => set({ month: Number(v) })}>
            <SelectTrigger size="sm" className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i} value={String(i + 1)}>
                  {monthName(i + 1, es ? "es" : "en")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(value.year)} onValueChange={(v) => set({ year: Number(v) })}>
            <SelectTrigger size="sm" className="w-[5.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground hidden sm:inline">
        {monthCount} {es ? "meses" : "months"}
      </span>
      <Popover open={!!draft} onOpenChange={open}>
        <PopoverTrigger asChild>
          <Button
            variant={isCustom || draft ? "secondary" : "ghost"}
            size="icon-xs"
            title={es ? "Configurar rango" : "Configure range"}
          >
            <Settings2 className="size-4" strokeWidth={1.5} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <div className="mb-3">
            <h4 className="font-medium text-sm">{es ? "Rango de fechas" : "Date range"}</h4>
            <p className="text-xs text-muted-foreground">{es ? "Selecciona el período a mostrar" : "Select the period to display"}</p>
          </div>
          {draft && available && (
            <div className="space-y-4">
              {picker(es ? "Desde" : "From", "start")}
              {picker(es ? "Hasta" : "To", "end")}
              <div className="flex gap-2 justify-end pt-2 border-t">
                <Button variant="ghost" size="sm" onClick={() => close(null)}>
                  {es ? "Restablecer" : "Reset"}
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    close({ startYear: draft.start.year, startMonth: draft.start.month, endYear: draft.end.year, endMonth: draft.end.month })
                  }
                >
                  {es ? "Aplicar" : "Apply"}
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
