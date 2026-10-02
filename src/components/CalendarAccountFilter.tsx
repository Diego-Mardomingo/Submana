"use client";

import { useState } from "react";
import { ListFilter } from "lucide-react";
import { Chips, FieldGroup, FieldStack, SheetButton } from "@/components/SheetFields";
import { Sheet, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { useCalendarAccountFilter } from "@/contexts/CalendarFilterContext";
import { useAccounts } from "@/hooks/useAccounts";
import { useLang } from "@/hooks/useLang";
import { cn } from "@/lib/utils";

/** Header button that opens a sheet to choose which accounts the calendar shows. */
export default function CalendarAccountFilter() {
  const es = useLang() === "es";
  const { data: accounts = [] } = useAccounts();
  const { hiddenAccountIds, setHiddenAccountIds } = useCalendarAccountFilter();
  const [open, setOpen] = useState(false);
  // Ids of accounts that no longer exist don't count.
  const hiddenCount = accounts.filter((acc) => hiddenAccountIds.has(acc.id)).length;

  // With one account there is nothing to filter (unless it was hidden before).
  if (accounts.length < 2 && hiddenCount === 0) return null;

  const visible = accounts.filter((acc) => !hiddenAccountIds.has(acc.id)).map((acc) => acc.id);
  const label = es ? "Filtrar cuentas" : "Filter accounts";

  return (
    <>
      <button
        type="button"
        className={cn("cal-filter-btn", hiddenCount > 0 && "is-active")}
        onClick={() => setOpen(true)}
        aria-label={hiddenCount > 0 ? `${label} (${hiddenCount} ${es ? "ocultas" : "hidden"})` : label}
      >
        <ListFilter className="size-[18px]" strokeWidth={2.25} aria-hidden />
        {hiddenCount > 0 && <span className="cal-filter-badge">{hiddenCount}</span>}
      </button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={es ? "Cuentas del calendario" : "Calendar accounts"}
        description={es ? "Elige qué cuentas aparecen en el calendario" : "Choose which accounts the calendar shows"}
      >
        <SheetBody>
          <FieldGroup
            hint={es ? "Se guarda en este dispositivo. No afecta al panel ni a tus movimientos." : "Saved on this device. It doesn't affect the dashboard or your transactions."}
          >
            <FieldStack
              label={es ? "Visibles" : "Visible"}
              aside={
                <span className="sf-row-label">
                  {visible.length}/{accounts.length}
                </span>
              }
            >
              <Chips
                multiple
                label={label}
                value={visible}
                onChange={(ids) => setHiddenAccountIds(new Set(accounts.filter((acc) => !ids.includes(acc.id)).map((acc) => acc.id)))}
                options={accounts.map((acc) => ({
                  value: acc.id,
                  label: acc.name,
                  color: acc.color || undefined,
                  icon: <span className="cal-filter-dot" style={{ background: acc.color || "var(--gris-claro)" }} aria-hidden />,
                }))}
              />
            </FieldStack>
          </FieldGroup>
        </SheetBody>
        <SheetFooter>
          <div className="sheet-footer-row">
            <SheetButton type="button" variant="ghost" onClick={() => setHiddenAccountIds(new Set())} disabled={hiddenCount === 0}>
              {es ? "Mostrar todas" : "Show all"}
            </SheetButton>
            <SheetButton type="button" onClick={() => setOpen(false)}>
              {es ? "Listo" : "Done"}
            </SheetButton>
          </div>
        </SheetFooter>
      </Sheet>
    </>
  );
}
