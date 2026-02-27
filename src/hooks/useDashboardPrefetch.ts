"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

async function fetchTransactions(year: number, month: number) {
  const params = new URLSearchParams();
  params.append("year", String(year));
  params.append("month", String(month));
  const res = await fetch(`/api/crud/transactions?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch transactions");
  const json = await res.json();
  return json.data ?? [];
}

async function fetchBudgets(month: string) {
  const res = await fetch(`/api/crud/budgets?month=${encodeURIComponent(month)}`);
  if (!res.ok) throw new Error("Failed to fetch budgets");
  const json = await res.json();
  return json.data ?? [];
}

function getMonthsRange(centerYear: number, centerMonth: number, range: number = 2) {
  const months: { year: number; month: number; monthStr: string }[] = [];
  
  for (let offset = -range; offset <= range; offset++) {
    let y = centerYear;
    let m = centerMonth + offset;
    
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    
    months.push({
      year: y,
      month: m,
      monthStr: `${y}-${String(m).padStart(2, "0")}`,
    });
  }
  
  return months;
}

export function useDashboardPrefetch() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Obtener rango de meses (mes actual ± 2 meses)
    const months = getMonthsRange(currentYear, currentMonth, 2);
    
    // Prefetch transacciones y presupuestos para cada mes
    months.forEach(({ year, month, monthStr }) => {
      // Prefetch transacciones (prioridad baja para meses no actuales)
      const isCurrentMonth = year === currentYear && month === currentMonth;
      
      queryClient.prefetchQuery({
        queryKey: queryKeys.transactions.list({ year, month }),
        queryFn: () => fetchTransactions(year, month),
        staleTime: isCurrentMonth ? 5 * 60 * 1000 : 15 * 60 * 1000,
      });
      
      queryClient.prefetchQuery({
        queryKey: queryKeys.budgets.list({ month: monthStr }),
        queryFn: () => fetchBudgets(monthStr),
        staleTime: isCurrentMonth ? 5 * 60 * 1000 : 15 * 60 * 1000,
      });
    });
  }, [queryClient]);
}
